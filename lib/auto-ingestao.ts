import { conectar, registrar } from "./db";
import { criarChat, conversar, type ResultadoAuto } from "./biblioteca-chat";
import { contemSegredoReal } from "./segredos";
import { iniciarEnriquecimento, pendentesDeFicha } from "./enriquecimento";

// Leitura automática de arquivos de texto enviados em "Novos conhecimentos".
// Cada trecho passa pelo mesmo fluxo do chat da Biblioteca: a IA identifica a categoria, confere o que já existe,
// incorpora o novo, soma o parecido ao item existente e retém só o que conflita.

const CHAVE = "auto_ingestao";
const TRECHO_MAX = 2000; // cada trecho gera umas 4 fichas completas, o que a IA escreve em cerca de um minuto
const LIMITE_TEXTO_TOTAL = 400_000;
const MAX_CONTINUACOES = 2;

export type StatusAuto = {
  estado: "Em andamento" | "Concluído" | "Falhou";
  chatId: number;
  arquivos: string;
  total: number;
  feitos: number;
  incorporadas: number;
  reforcadas: number;
  semNovidade: number;
  retidas: number;
  erro: string;
  custo: number;
  iniciado: string;
};

export function lerStatusAuto(): StatusAuto | null {
  const r = conectar().prepare("SELECT valor FROM configuracoes WHERE chave = ?").get(CHAVE) as { valor: string } | undefined;
  if (!r) return null;
  const s = JSON.parse(r.valor) as StatusAuto;
  // Se a Central foi reiniciada no meio, o trabalho não continua sozinho.
  if (s.estado === "Em andamento" && Date.now() - new Date(s.iniciado).getTime() > 90 * 60_000) return { ...s, estado: "Falhou", erro: "Interrompida (a Central foi reiniciada)." };
  return s;
}
function gravar(s: StatusAuto) {
  conectar().prepare("INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(CHAVE, JSON.stringify(s));
}

// Divide em trechos de até `max` caracteres, preferindo cortar em linha em branco e depois em quebra de linha.
export function dividirEmTrechos(texto: string, max = TRECHO_MAX): string[] {
  const blocos = texto.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter((b) => b && !/^-{3,}$/.test(b));
  const partes: string[] = [];
  let atual = "";
  // Títulos "#" e "##" (categoria, nível) valem para os itens seguintes: cada trecho novo repete esse contexto.
  let ctxTopo: string[] = [];
  let ctxSecao = "";
  const prefixo = () => [...ctxTopo, ctxSecao].filter(Boolean).join("\n");
  const empurrar = () => {
    if (atual.trim()) partes.push(atual.trim());
    atual = "";
  };
  for (const bloco of blocos) {
    const ehSecao = /^##\s/.test(bloco);
    const ehTopo = /^#\s/.test(bloco);
    if (ehTopo) ctxTopo = bloco.split("\n").filter((l) => /^#\s/.test(l));
    if (ehSecao) ctxSecao = bloco.split("\n")[0];
    if (!ehTopo && !ehSecao && !atual && prefixo()) atual = prefixo();
    if (bloco.length > max) {
      empurrar();
      let resto = bloco;
      while (resto.length > max) {
        let corte = resto.lastIndexOf("\n", max);
        if (corte < max / 2) corte = resto.lastIndexOf(" ", max);
        if (corte < max / 2) corte = max;
        partes.push(resto.slice(0, corte).trim());
        resto = resto.slice(corte).trim();
      }
      atual = resto;
      continue;
    }
    if (atual && atual.length + bloco.length + 2 > max) {
      empurrar();
      if (!ehTopo && !ehSecao && prefixo()) atual = prefixo();
    }
    atual = atual ? `${atual}\n\n${bloco}` : bloco;
  }
  empurrar();
  return partes.filter(Boolean);
}

export type ArquivoTexto = { nome: string; texto: string; materialId: number | null };

export function iniciarAutoIngestao(arquivos: ArquivoTexto[]): { chatId: number; trechos: number } {
  const atual = lerStatusAuto();
  if (atual?.estado === "Em andamento") throw new Error("Já existe uma leitura automática em andamento. Aguarde terminar.");
  const total = arquivos.reduce((n, a) => n + a.texto.length, 0);
  if (total > LIMITE_TEXTO_TOTAL) throw new Error("Texto grande demais para uma leitura só. Envie em arquivos menores.");
  for (const a of arquivos) if (contemSegredoReal(a.texto)) throw new Error(`O arquivo ${a.nome} parece conter um segredo (chave, token ou senha). Remova antes de enviar.`);
  const itens = arquivos.flatMap((a) => dividirEmTrechos(a.texto).map((t, i, todos) => ({ nome: a.nome, materialId: a.materialId, texto: t, indice: i + 1, de: todos.length })));
  if (itens.length === 0) throw new Error("Não há texto para ler.");
  const chatId = criarChat();
  conectar().prepare("UPDATE chats_biblioteca SET titulo = ? WHERE id = ?").run(`Arquivo: ${arquivos.map((a) => a.nome).join(", ")}`.slice(0, 70), chatId);
  const inicial: StatusAuto = {
    estado: "Em andamento", chatId, arquivos: arquivos.map((a) => a.nome).join(", "), total: itens.length, feitos: 0,
    incorporadas: 0, reforcadas: 0, semNovidade: 0, retidas: 0, erro: "", custo: 0, iniciado: new Date().toISOString(),
  };
  gravar(inicial);
  registrar(`Leitura automática iniciada: ${arquivos.map((a) => a.nome).join(", ")} em ${itens.length} trecho(s)`);
  void executar(inicial, itens).catch((e) => {
    const s = lerStatusAuto();
    if (s) gravar({ ...s, estado: "Falhou", erro: e instanceof Error ? e.message : "Erro inesperado." });
  });
  return { chatId, trechos: itens.length };
}

function custoDoChat(chatId: number): number {
  const r = conectar().prepare("SELECT COALESCE(SUM(custo_usd), 0) AS c FROM chat_biblioteca_msgs WHERE chat_id = ?").get(chatId) as { c: number };
  return r.c;
}

async function executar(inicio: StatusAuto, itens: { nome: string; materialId: number | null; texto: string; indice: number; de: number }[]) {
  const s = { ...inicio };
  const falhas: string[] = [];
  const somar = (a: ResultadoAuto | null) => {
    if (!a) return;
    s.incorporadas += a.incorporadas;
    s.reforcadas += a.reforcadas;
    s.semNovidade += a.semNovidade;
    s.retidas += a.retidas;
  };
  for (const it of itens) {
    try {
      // Cada trecho começa uma sessão nova, para o contexto não crescer e o custo não explodir.
      conectar().prepare("UPDATE chats_biblioteca SET claude_session_id = NULL WHERE id = ?").run(s.chatId);
      const cabecalho = `Trecho ${it.indice} de ${it.de} do arquivo "${it.nome}". Leia, identifique as práticas e proponha. Origem: arquivo ${it.nome}.\n\n`;
      let r = await conversar(s.chatId, cabecalho + it.texto, { auto: true, materialId: it.materialId });
      somar(r);
      // Se a IA devolveu o limite de propostas, pode haver mais itens no mesmo trecho.
      for (let k = 0; k < MAX_CONTINUACOES && r && r.propostas >= 10; k++) {
        r = await conversar(s.chatId, "Continue: proponha as práticas deste mesmo trecho que você ainda não propôs.", { auto: true, materialId: it.materialId });
        somar(r);
      }
    } catch (e) {
      falhas.push(`trecho ${it.indice} de ${it.nome}: ${e instanceof Error ? e.message : "erro"}`);
    }
    s.feitos++;
    s.custo = custoDoChat(s.chatId);
    s.erro = falhas.join(" | ");
    gravar(s);
  }
  s.estado = "Concluído";
  s.custo = custoDoChat(s.chatId);
  gravar(s);
  // Itens que entraram sem ficha completa (a IA não a devolveu) são completados em seguida.
  try {
    if (pendentesDeFicha().length > 0) iniciarEnriquecimento();
  } catch {
    /* já há um enriquecimento em andamento: ele cobre o que faltar na próxima rodada */
  }
  registrar(`Leitura automática concluída: ${s.incorporadas} incorporado(s), ${s.reforcadas} reforço(s), ${s.semNovidade} sem novidade, ${s.retidas} retido(s) por conflito`);
}
