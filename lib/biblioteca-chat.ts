import { conectar, registrar } from "./db";
import { perguntar } from "./claude";
import { obterSolucao, incorporarDoUsuario, solucaoPorTitulo, NIVEIS, ROTULO_NIVEL, type Nivel, type Solucao } from "./solucoes";
import { lerConteudo, temFichaNova } from "./ficha-texto";
import { consultaFtsLonga } from "./busca";
import { CATEGORIAS, SLUGS, TIPOS_SOLUCAO } from "./categorias";
import { ingerir } from "./ingestao";
import { contemSegredoReal } from "./segredos";
import { CAMPOS_FICHA, FORMATO_CAMPOS_FICHA, lerCamposFicha } from "./ficha-texto";

export const MODELO_BIBLIOTECA = process.env.CENTRAL_MODELO_BIBLIOTECA || "sonnet";
export const LIMITE_TEXTO = 12000; // por chamada da IA; textos maiores são divididos em trechos pela leitura automática

export type Chat = { id: number; titulo: string; claude_session_id: string | null; criado_em: string };
export type Msg = { id: number; chat_id: number; papel: "usuario" | "claude" | "sistema"; texto: string; material_id: number | null; custo_usd: number | null; criado_em: string };
export type Proposta = {
  id: number; chat_id: number; msg_id: number; titulo: string; tipo: string; categorias: string; nivel: Nivel | null;
  descricao: string; limitacoes: string; origem: string; relacao: "nova" | "parcial" | "duplicada"; existente: string;
  resumo: string; pilar: string; explicacao: string; justificativa_nivel: string; reforco: string; conflito: string;
  estado: "Pendente" | "Incorporada" | "Descartada" | "Substituída"; solucao_id: number | null; criado_em: string;
};
export type PropostaLida = Omit<Proposta, "id" | "chat_id" | "msg_id" | "estado" | "solucao_id" | "criado_em" | "categorias" | "resumo" | "pilar" | "explicacao" | "justificativa_nivel" | "reforco" | "conflito"> & {
  categorias: string[]; resumo: string; pilar: string; explicacao: string; justificativa_nivel: string; reforco: string; conflito: string;
};

export function criarChat(): number {
  return Number(conectar().prepare("INSERT INTO chats_biblioteca DEFAULT VALUES").run().lastInsertRowid);
}
export function obterChat(id: number): Chat | undefined {
  return conectar().prepare("SELECT * FROM chats_biblioteca WHERE id = ?").get(id) as Chat | undefined;
}
export function listarChats(limite = 8): Chat[] {
  return conectar().prepare("SELECT * FROM chats_biblioteca ORDER BY id DESC LIMIT ?").all(limite) as Chat[];
}
export function listarMsgs(chatId: number): Msg[] {
  return conectar().prepare("SELECT * FROM chat_biblioteca_msgs WHERE chat_id = ? ORDER BY id").all(chatId) as Msg[];
}
export function listarPropostas(chatId: number): Proposta[] {
  return conectar().prepare("SELECT * FROM chat_biblioteca_propostas WHERE chat_id = ? ORDER BY id").all(chatId) as Proposta[];
}
function obterProposta(id: number): Proposta | undefined {
  return conectar().prepare("SELECT * FROM chat_biblioteca_propostas WHERE id = ?").get(id) as Proposta | undefined;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

type Existente = { titulo: string; cat: string; nivel: Nivel | null; situacao: string };
function existentes(): Existente[] {
  return conectar()
    .prepare(
      `SELECT s.titulo AS titulo, COALESCE((SELECT categoria FROM solucao_categorias WHERE solucao_id = s.id AND principal = 1), '') AS cat, s.nivel AS nivel, s.situacao AS situacao
       FROM solucoes s WHERE s.situacao IN ('Incorporada','Proposta') ORDER BY s.id`,
    )
    .all() as Existente[];
}

// Os itens mais parecidos com o texto, por busca local (sem custo). A IA recebe o detalhe só destes.
export function candidatos(texto: string, limite = 8): Solucao[] {
  const fts = consultaFtsLonga(texto);
  if (!fts) return [];
  const linhas = conectar()
    .prepare("SELECT ref_id FROM busca WHERE busca MATCH ? AND tipo = 'solucao' ORDER BY bm25(busca) LIMIT ?")
    .all(fts, limite * 4) as { ref_id: number }[];
  const vistos = new Set<number>();
  const saida: Solucao[] = [];
  for (const l of linhas) {
    if (vistos.has(l.ref_id)) continue;
    vistos.add(l.ref_id);
    const s = obterSolucao(l.ref_id);
    if (s && (s.situacao === "Incorporada" || s.situacao === "Proposta")) saida.push(s);
    if (saida.length >= limite) break;
  }
  return saida;
}

const LISTA_CATEGORIAS = CATEGORIAS.map((c) => `${c.slug} (${c.nome}: ${c.resumo})`).join("; ");

export const INSTRUCOES_BIBLIOTECA = `Você ajuda o usuário a trazer conhecimento de engenharia para a Biblioteca de Engenharia dele. Em cada mensagem ele cola um texto ou conta uma ideia. Sua tarefa: entender o conteúdo, identificar a categoria certa entre as 13, verificar se a Biblioteca JÁ tem isso e propor o que falta.
Responda em português do Brasil, curto e direto, sem travessão longo. Em 2 a 5 frases diga o que identificou, em que categoria vai e se já existe, por completo ou em parte, citando o título EXATO dos itens existentes. Se o usuário só fizer uma pergunta, responda a pergunta.
Ao FINAL de toda resposta inclua um bloco <propostas>JSON</propostas> com a lista (pode ser []) de itens a incorporar. Regras:
- Uma prática distinta por proposta. Se o texto traz várias práticas diferentes, separe em várias propostas.
- "relacao": "nova" (não existe; será incorporada direto à Biblioteca), "parcial" (já existe algo relacionado e a proposta complementa; preencha "existente" com o título EXATO) ou "duplicada" (já existe de forma equivalente; preencha "existente" com o título EXATO). Itens "parcial" e "duplicada" NÃO viram item novo: o que trazem de a mais é somado ao item existente, reforçando-o.
- "reforco": só para "parcial" e "duplicada": {"acrescenta":"1 a 2 frases do que o texto traz a MAIS que o item existente (vazio se nada)","conceitos":[{"nome":"","significa":""}]} com 0 a 3 conceitos que o item existente ainda não explica. Para "nova", use {"acrescenta":"","conceitos":[]}.
- "conflita_com": preencha SOMENTE se a proposta CONTRADIZ tecnicamente um item existente (recomenda o oposto ou é incompatível), com o título EXATO dele, e explique em "motivo_conflito" (até 300 caracteres). Diferença de nível, de detalhe ou de tecnologia NÃO é conflito. Na dúvida, vazio.
- No máximo 10 propostas por resposta. Se o texto tiver mais práticas, proponha as 10 mais importantes e diga no texto quantas faltaram.
- "categorias": de 1 a 3 entre: ${LISTA_CATEGORIAS}. A primeira é a principal. Escolha pelo assunto real do conteúdo, não por palavras soltas.
- "tipo": Procedimento, Código, Padrão, Conhecimento ou Checklist.
- "nivel": se o texto do usuário já indicar o nível da prática (por exemplo sob um título "Nível Staff"), use exatamente esse nível. Senão, decida você, conforme a ficha completa abaixo. Como a proposta entra sem revisão, decida SEMPRE um nível para Checklist, Padrão, Código e Procedimento; deixe vazio só para Conhecimento puro. Se "relacao" for "duplicada", deixe "nivel" vazio.
${CAMPOS_FICHA}
- "descricao": reescreva o conteúdo do usuário de forma organizada e fiel, mantendo nomes de ferramentas e termos. Não acrescente fatos, números nem benefícios que ele não trouxe.
- "limitacoes": só limites que o próprio texto indicar ou que sejam tecnicamente evidentes. Se não houver, vazio.
- "origem": a fonte que o usuário citar. Se não citou, vazio.
- Nunca inclua segredos, chaves ou senhas.
- As propostas sem conflito entram na Biblioteca automaticamente, sem revisão do usuário. Por isso: nada de inventar, e título genérico e reutilizável, sem nome de sistema, empresa ou arquivo específico.
Formato: <propostas>[{"titulo":"","tipo":"","categorias":[""],"descricao":"","limitacoes":"","origem":"","relacao":"","existente":"","reforco":{"acrescenta":"","conceitos":[]},"conflita_com":"","motivo_conflito":"",${FORMATO_CAMPOS_FICHA}}]</propostas>`;

export function montarEntrada(texto: string): string {
  const todos = existentes();
  const lista = todos
    .map((e) => `- ${e.titulo} [${e.cat || "sem categoria"} | ${e.nivel ? ROTULO_NIVEL[e.nivel] : "sem nível"}${e.situacao === "Proposta" ? " | proposta ainda não aprovada" : ""}]`)
    .join("\n");
  const cand = candidatos(texto)
    .map((s) => `### ${s.titulo} [${s.categorias.join(", ")} | ${s.nivel ? ROTULO_NIVEL[s.nivel] : "sem nível"}]\n${s.descricao.replace(/\s+/g, " ").slice(0, 500)}`)
    .join("\n\n");
  return `ITENS QUE JÁ EXISTEM NA BIBLIOTECA (título [categoria principal | nível]):\n${lista || "(a Biblioteca está vazia)"}\n\nCANDIDATOS MAIS PARECIDOS COM O TEXTO, COM DETALHE:\n${cand || "(nenhum candidato próximo)"}\n\nMENSAGEM DO USUÁRIO:\n${texto}`;
}

export type Leitura = { visivel: string; propostas: PropostaLida[]; descartes: string[]; falhou: boolean };

export function extrairPropostas(resposta: string, titulos: string[]): Leitura {
  const regex = /<propostas>([\s\S]*?)<\/propostas>/gi;
  const blocos = [...resposta.matchAll(regex)];
  const visivel = resposta.replace(regex, "").trim();
  if (blocos.length === 0) return { visivel, propostas: [], descartes: [], falhou: true };
  const bruto = blocos[blocos.length - 1][1].trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let lista: unknown;
  try {
    lista = JSON.parse(bruto);
  } catch {
    return { visivel, propostas: [], descartes: [], falhou: true };
  }
  if (!Array.isArray(lista)) return { visivel, propostas: [], descartes: [], falhou: true };

  const descartes: string[] = [];
  const mapa = new Map(titulos.map((t) => [norm(t), t]));
  const propostas: PropostaLida[] = [];
  const vistos = new Set<string>();
  const txt = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  for (const x of lista.slice(0, 10)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const titulo = txt(o.titulo);
    const rotulo = titulo || "(sem título)";
    const tipo = txt(o.tipo);
    const descricao = txt(o.descricao);
    if (!titulo || titulo.length > 150) { descartes.push(`${rotulo}: título ausente ou longo demais`); continue; }
    if (!(TIPOS_SOLUCAO as readonly string[]).includes(tipo)) { descartes.push(`${rotulo}: tipo inválido`); continue; }
    if (!descricao || descricao.length > 5000) { descartes.push(`${rotulo}: descrição ausente ou grande demais`); continue; }
    const cats = [...new Set((Array.isArray(o.categorias) ? o.categorias : []).map(txt).filter((c) => SLUGS.includes(c)))].slice(0, 3);
    if (cats.length === 0) { descartes.push(`${rotulo}: sem categoria válida`); continue; }
    const limitacoes = txt(o.limitacoes).slice(0, 1500);
    const origem = txt(o.origem).slice(0, 250);
    if ([titulo, descricao, limitacoes, origem].some(contemSegredoReal)) { descartes.push(`${rotulo}: parecia conter segredo`); continue; }
    if (vistos.has(norm(titulo))) { descartes.push(`${rotulo}: título repetido`); continue; }
    vistos.add(norm(titulo));

    let relacao = (["nova", "parcial", "duplicada"] as const).find((r) => r === txt(o.relacao)) ?? "nova";
    let existente = mapa.get(norm(txt(o.existente))) ?? "";
    if (relacao !== "nova" && !existente) {
      descartes.push(`${rotulo}: a IA citou um item existente que não bate com nenhum título (tratado como nova)`);
      relacao = "nova";
    }
    // Conferência independente da IA: título idêntico a um que já existe é duplicado.
    const igual = mapa.get(norm(titulo));
    if (igual) {
      relacao = "duplicada";
      existente = igual;
    }
    // A ficha completa (resumo, pilar, nível justificado, explicação) vem junto. Sem ela a proposta é mantida, mas o aviso aparece.
    const lida = lerCamposFicha(o);
    // Itens que serão somados a um existente não precisam de ficha própria.
    if (!lida.ficha && relacao === "nova") descartes.push(`${rotulo}: ${lida.problema} (a ficha será completada depois)`);
    const nivel = relacao === "duplicada" ? null : (lida.ficha?.nivel ?? null);
    // Reforço: o que a proposta soma a um item existente (conceitos novos e uma frase do que acrescenta).
    const rb = (o.reforco ?? {}) as Record<string, unknown>;
    const reforcoConceitos = (Array.isArray(rb.conceitos) ? rb.conceitos : []).map((c) => {
      const y = (c ?? {}) as Record<string, unknown>;
      return { nome: txt(y.nome).replace(/::/g, ":").slice(0, 140), significa: txt(y.significa).replace(/::/g, ":").slice(0, 900) };
    }).filter((c) => c.nome && c.significa).slice(0, 3);
    const acrescenta = txt(rb.acrescenta).slice(0, 500);
    const reforco = relacao === "nova" || (!acrescenta && reforcoConceitos.length === 0) ? "" : JSON.stringify({ acrescenta, conceitos: reforcoConceitos });
    if (reforco && contemSegredoReal(reforco)) { descartes.push(`${rotulo}: reforço parecia conter segredo`); continue; }
    // Conflito: só vale com título existente exato e motivo explicado.
    const confBruto = txt(o.conflita_com);
    const confTitulo = confBruto ? (mapa.get(norm(confBruto)) ?? "") : "";
    const motivo = txt(o.motivo_conflito).slice(0, 400);
    if (confBruto && (!confTitulo || motivo.length < 15)) descartes.push(`${rotulo}: conflito sem título existente ou sem explicação (ignorado)`);
    const conflito = confTitulo && motivo.length >= 15 ? `${confTitulo}: ${motivo}` : "";
    propostas.push({
      titulo, tipo, categorias: cats, nivel, descricao, limitacoes, origem, relacao, existente,
      resumo: lida.ficha?.resumo ?? "", pilar: lida.ficha?.pilar ?? "", explicacao: lida.ficha?.explicacao ?? "",
      justificativa_nivel: nivel ? (lida.ficha?.justificativaNivel ?? "") : "", reforco, conflito,
    });
  }
  return { visivel, propostas, descartes, falhou: false };
}

export type ResultadoAuto = { incorporadas: number; reforcadas: number; retidas: number; semNovidade: number; propostas: number };

// Auto-ingestão: o que não tem conflito entra sozinho. Novo vira item; parecido é somado ao item existente.
function aplicarAuto(chatId: number, msgId: number): ResultadoAuto {
  const r: ResultadoAuto = { incorporadas: 0, reforcadas: 0, retidas: 0, semNovidade: 0, propostas: 0 };
  const props = listarPropostas(chatId).filter((p) => p.msg_id === msgId && p.estado === "Pendente");
  r.propostas = props.length;
  for (const p of props) {
    try {
      if (p.conflito) { r.retidas++; continue; }
      const alvo = p.relacao !== "nova" && p.existente ? solucaoPorTitulo(p.existente) : undefined;
      if (alvo) {
        if (reforcar(p, alvo.id)) r.reforcadas++; else r.semNovidade++;
        continue;
      }
      incorporar(p.id, { categorias: JSON.parse(p.categorias), nivel: p.nivel ?? "", origem: p.origem, mesmoAssim: true });
      r.incorporadas++;
    } catch (e) {
      registrar(`Auto-ingestão: não foi possível tratar "${p.titulo}": ${e instanceof Error ? e.message : "erro"}`);
    }
  }
  return r;
}

// Soma a uma solução existente o que a proposta traz a mais: conceitos novos, uma nota de reforço e as categorias.
function reforcar(p: Proposta, solucaoId: number): boolean {
  const c = conectar();
  const ex = obterSolucao(solucaoId);
  if (!ex) return false;
  const ref = (p.reforco ? JSON.parse(p.reforco) : {}) as { acrescenta?: string; conceitos?: { nome: string; significa: string }[] };
  const conteudo = temFichaNova(ex.explicacao) ? lerConteudo(ex.explicacao) : null;
  const jaTem = new Set((conteudo?.conceitos ?? []).map((x) => norm(x.nome)));
  const novos = conteudo ? (ref.conceitos ?? []).filter((x) => !jaTem.has(norm(x.nome))).slice(0, Math.max(0, 8 - conteudo.conceitos.length)) : [];
  const catsNovas: string[] = []; // o reforço não muda as categorias do item existente, para não haver deriva de classificação
  const acrescenta = (ref.acrescenta ?? "").trim();
  if (novos.length === 0 && !acrescenta && catsNovas.length === 0) {
    c.prepare("UPDATE chat_biblioteca_propostas SET estado = 'Descartada', solucao_id = ? WHERE id = ?").run(solucaoId, p.id);
    registrar(`Auto-ingestão: "${p.titulo}" já estava coberto por "${ex.titulo}", nada a somar`);
    return false;
  }
  const linhasNovas = novos.map((x, i) => `${(conteudo?.conceitos.length ?? 0) + i + 1}. ${x.nome} :: ${x.significa}`);
  const explicacao = novos.length > 0 ? [ex.explicacao, ...linhasNovas].join("\n") : ex.explicacao;
  const nota = acrescenta ? `\n\n[Reforço em ${new Date().toISOString().slice(0, 10)}${p.origem ? `, origem: ${p.origem}` : ""}] ${acrescenta}` : "";
  const descricao = `${ex.descricao}${nota}`.slice(0, 5000);
  c.exec("BEGIN");
  try {
    c.prepare("UPDATE solucoes SET explicacao = ?, descricao = ? WHERE id = ?").run(explicacao, descricao, solucaoId);
    const insCat = c.prepare("INSERT OR IGNORE INTO solucao_categorias (solucao_id, categoria, principal) VALUES (?, ?, 0)");
    for (const cat of catsNovas) insCat.run(solucaoId, cat);
    c.prepare("INSERT INTO busca (tipo, ref_id, projeto_id, texto) VALUES ('solucao', ?, 0, ?)").run(solucaoId, `${ex.titulo} ${acrescenta} ${novos.map((x) => `${x.nome} ${x.significa}`).join(" ")}`);
    c.prepare("UPDATE chat_biblioteca_propostas SET estado = 'Incorporada', solucao_id = ? WHERE id = ?").run(solucaoId, p.id);
    c.exec("COMMIT");
  } catch (e) {
    c.exec("ROLLBACK");
    throw e;
  }
  registrar(`Auto-ingestão: "${ex.titulo}" reforçado com ${novos.length} conceito(s)${catsNovas.length ? ` e ${catsNovas.length} categoria(s)` : ""}, a partir de "${p.titulo}"`);
  return true;
}

export async function conversar(chatId: number, textoBruto: string, opcoes: { auto?: boolean; materialId?: number | null } = {}): Promise<ResultadoAuto | null> {
  const chat = obterChat(chatId);
  if (!chat) throw new Error("Conversa não encontrada.");
  const texto = textoBruto.trim();
  if (!texto) throw new Error("Escreva ou cole o conteúdo.");
  if (texto.length > LIMITE_TEXTO) throw new Error(`O texto passou de ${LIMITE_TEXTO} caracteres. Envie em partes.`);
  if (contemSegredoReal(texto)) throw new Error("O texto parece conter um segredo (chave, token ou senha). Remova antes de enviar.");

  const c = conectar();
  const primeira = (c.prepare("SELECT COUNT(*) AS n FROM chat_biblioteca_msgs WHERE chat_id = ?").get(chatId) as { n: number }).n === 0;
  c.prepare("INSERT INTO chat_biblioteca_msgs (chat_id, papel, texto, material_id) VALUES (?, 'usuario', ?, ?)").run(chatId, texto, opcoes.materialId ?? null);
  if (primeira) c.prepare("UPDATE chats_biblioteca SET titulo = ? WHERE id = ?").run(texto.replace(/\s+/g, " ").slice(0, 70), chatId);

  const titulos = existentes().map((e) => e.titulo);
  try {
    const r = await perguntar(montarEntrada(texto), chat.claude_session_id ?? undefined, INSTRUCOES_BIBLIOTECA, { modelo: MODELO_BIBLIOTECA, tempoMaximoMs: 8 * 60_000 });
    c.prepare("UPDATE chats_biblioteca SET claude_session_id = ? WHERE id = ?").run(r.sessionId, chatId);
    const lida = extrairPropostas(r.texto, titulos);
    const m = c
      .prepare("INSERT INTO chat_biblioteca_msgs (chat_id, papel, texto, custo_usd) VALUES (?, 'claude', ?, ?)")
      .run(chatId, lida.visivel || "(sem texto)", r.custo);
    const msgId = Number(m.lastInsertRowid);
    const auto = opcoes.auto !== false;
    if (lida.propostas.length > 0) {
      if (!auto) c.prepare("UPDATE chat_biblioteca_propostas SET estado = 'Substituída' WHERE chat_id = ? AND estado = 'Pendente'").run(chatId);
      const ins = c.prepare(
        `INSERT INTO chat_biblioteca_propostas (chat_id, msg_id, titulo, tipo, categorias, nivel, descricao, limitacoes, origem, relacao, existente, resumo, pilar, explicacao, justificativa_nivel, reforco, conflito)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const p of lida.propostas) ins.run(chatId, msgId, p.titulo, p.tipo, JSON.stringify(p.categorias), p.nivel, p.descricao, p.limitacoes, p.origem, p.relacao, p.existente, p.resumo, p.pilar, p.explicacao, p.justificativa_nivel, p.reforco, p.conflito);
    }
    if (lida.falhou) c.prepare("INSERT INTO chat_biblioteca_msgs (chat_id, papel, texto) VALUES (?, 'sistema', ?)").run(chatId, "A resposta veio sem o bloco de propostas. Peça de novo, por exemplo: \"proponha os itens\".");
    else if (lida.descartes.length > 0) c.prepare("INSERT INTO chat_biblioteca_msgs (chat_id, papel, texto) VALUES (?, 'sistema', ?)").run(chatId, `A Central ajustou ou descartou: ${lida.descartes.join("; ")}`);
    registrar(`Chat da Biblioteca: ${lida.propostas.length} proposta(s)`);
    if (auto && lida.propostas.length > 0) {
      const a = aplicarAuto(chatId, msgId);
      const partes = [
        a.incorporadas ? `${a.incorporadas} incorporado(s) à Biblioteca` : "",
        a.reforcadas ? `${a.reforcadas} somado(s) a itens existentes (reforço)` : "",
        a.semNovidade ? `${a.semNovidade} já existia(m), sem nada a somar` : "",
        a.retidas ? `${a.retidas} retido(s) por conflito, para você decidir abaixo` : "",
      ].filter(Boolean);
      c.prepare("INSERT INTO chat_biblioteca_msgs (chat_id, papel, texto) VALUES (?, 'sistema', ?)").run(chatId, `Auto-ingestão: ${partes.join(", ") || "nada a incorporar"}.`);
      return a;
    }
    return null;
  } catch (e) {
    c.prepare("INSERT INTO chat_biblioteca_msgs (chat_id, papel, texto) VALUES (?, 'sistema', ?)").run(chatId, (e as Error).message);
    return null;
  }
}

const carimbo = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{6})$/, "$1-$2");

export function incorporar(propostaId: number, ajustes: { categorias: string[]; nivel: string; origem: string; mesmoAssim: boolean }): number {
  const p = obterProposta(propostaId);
  if (!p) throw new Error("Proposta não encontrada.");
  if (p.estado !== "Pendente") throw new Error("Esta proposta já foi decidida ou substituída.");
  if (p.relacao === "duplicada" && !ajustes.mesmoAssim) throw new Error("A IA identificou que isto já existe. Use \"Incorporar mesmo assim\" se discordar.");
  const cats = [...new Set(ajustes.categorias)].filter((c) => SLUGS.includes(c)).slice(0, 3);
  if (cats.length === 0) throw new Error("Escolha ao menos uma categoria.");
  if (ajustes.nivel !== "" && !(NIVEIS as string[]).includes(ajustes.nivel)) throw new Error("Nível inválido.");

  const c = conectar();
  // O texto que o usuário colou é o original: fica preservado como material de origem.
  const usuario = c
    .prepare("SELECT id, texto, material_id FROM chat_biblioteca_msgs WHERE chat_id = ? AND papel = 'usuario' AND id < ? ORDER BY id DESC LIMIT 1")
    .get(p.chat_id, p.msg_id) as { id: number; texto: string; material_id: number | null } | undefined;
  let materialId = usuario?.material_id ?? null;
  if (usuario && !materialId) {
    const r = ingerir(`texto-colado-${carimbo()}.txt`, Buffer.from(usuario.texto, "utf8"));
    if (r.situacao === "recebido" || r.situacao === "duplicado") {
      materialId = r.id;
      c.prepare("UPDATE chat_biblioteca_msgs SET material_id = ? WHERE id = ?").run(materialId, usuario.id);
    }
  }

  const origem = (ajustes.origem.trim() || p.origem || `Conteúdo trazido pelo usuário em ${new Date().toISOString().slice(0, 10)}`).slice(0, 300);
  const limitacoes = [p.limitacoes, "Conteúdo trazido pelo usuário de fonte externa. Não foi validado pela Central."].filter(Boolean).join(" ");
  const chave = `chat:${p.id}`;
  incorporarDoUsuario({
    titulo: p.titulo, tipo: p.tipo, descricao: p.descricao, origem, materialId, limitacoes, categorias: cats,
    nivel: ajustes.nivel === "" ? null : (ajustes.nivel as Nivel), chaveOrigem: chave, estado: "Recebido",
    // Se o usuário manteve o nível da IA, ele continua marcado como sugestão da IA. Se mudou, passa a ser do usuário.
    ficha: { resumo: p.resumo, pilar: p.pilar, explicacao: p.explicacao, justificativaNivel: p.justificativa_nivel, nivelPor: (p.nivel ?? "") === ajustes.nivel ? "IA" : "Usuário" },
  });
  const s = c.prepare("SELECT id FROM solucoes WHERE chave_origem = ?").get(chave) as { id: number };
  c.prepare("UPDATE chat_biblioteca_propostas SET estado = 'Incorporada', solucao_id = ? WHERE id = ?").run(s.id, p.id);
  registrar(`Solução incorporada pelo usuário a partir do chat da Biblioteca: ${p.titulo}`);
  return s.id;
}

export function descartar(propostaId: number) {
  const p = obterProposta(propostaId);
  if (!p || p.estado !== "Pendente") throw new Error("Proposta não encontrada ou já decidida.");
  conectar().prepare("UPDATE chat_biblioteca_propostas SET estado = 'Descartada' WHERE id = ?").run(propostaId);
}
