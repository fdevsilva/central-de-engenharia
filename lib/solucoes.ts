import { conectar, registrar, decidirAprovacao } from "./db";
import { SLUGS, TIPOS_SOLUCAO, ESTADOS_VALIDACAO, ESTADOS_COM_EVIDENCIA } from "./categorias";

export type Solucao = {
  id: number;
  titulo: string;
  tipo: string;
  descricao: string;
  origem: string;
  material_id: number | null;
  estado: string;
  limitacoes: string;
  situacao: "Proposta" | "Incorporada" | "Rejeitada";
  nivel: Nivel | null;
  chave_origem: string | null;
  resumo: string;
  pilar: string;
  explicacao: string;
  justificativa_nivel: string;
  nivel_por: "" | "IA" | "Usuário" | "Documento";
  criado_em: string;
  categorias: string[];
};

// Ficha completa de uma solução, além do texto da fonte: o que é, em qual pilar, por que esse nível e o que cada termo significa.
export type Ficha = { resumo?: string; pilar?: string; explicacao?: string; justificativaNivel?: string; nivelPor?: "IA" | "Usuário" | "Documento" | "" };

export type Nivel = "BASE" | "SÊNIOR" | "STAFF";
export const NIVEIS: Nivel[] = ["BASE", "SÊNIOR", "STAFF"];
export const RANK: Record<Nivel, number> = { BASE: 1, SÊNIOR: 2, STAFF: 3 };
export const ROTULO_NIVEL: Record<Nivel, string> = { BASE: "Júnior", SÊNIOR: "Sênior", STAFF: "Staff" };

// Definições dos níveis, copiadas do cabeçalho do framework do usuário.
export const SIGNIFICADO_NIVEL: Record<Nivel, string> = {
  BASE: "Todo sistema em produção precisa ter, sem exceção.",
  SÊNIOR: "Separa quem entrega \"funcionando\" de quem entrega \"correto\".",
  STAFF: "Separa quem entrega \"correto\" de quem entrega \"à prova do tempo e da escala\", nível de decisão de arquitetura.",
};

export type Evidencia = { id: number; solucao_id: number; descricao: string; referencia: string; criado_em: string };

type Linha = Omit<Solucao, "categorias">;

// Estados que a pessoa pode escolher ao propor: validação só depois, com evidência.
export const ESTADOS_INICIAIS = ESTADOS_VALIDACAO.filter((e) => !ESTADOS_COM_EVIDENCIA.includes(e));

function comCategorias(l: Linha): Solucao {
  const cats = conectar()
    .prepare("SELECT categoria FROM solucao_categorias WHERE solucao_id = ? ORDER BY categoria")
    .all(l.id) as { categoria: string }[];
  return { ...l, categorias: cats.map((c) => c.categoria) };
}

export function obterSolucao(id: number): Solucao | undefined {
  const l = conectar().prepare("SELECT * FROM solucoes WHERE id = ?").get(id) as Linha | undefined;
  return l && comCategorias(l);
}

export function listarSolucoes(filtro: { categoria?: string; situacao?: string } = {}): Solucao[] {
  const onde: string[] = [];
  const args: string[] = [];
  if (filtro.categoria) {
    onde.push("id IN (SELECT solucao_id FROM solucao_categorias WHERE categoria = ?)");
    args.push(filtro.categoria);
  }
  if (filtro.situacao) {
    onde.push("situacao = ?");
    args.push(filtro.situacao);
  }
  const sql = `SELECT * FROM solucoes ${onde.length ? "WHERE " + onde.join(" AND ") : ""}
    ORDER BY (situacao = 'Incorporada') DESC, id DESC`;
  return (conectar().prepare(sql).all(...args) as Linha[]).map(comCategorias);
}

export function listarPorMaterial(materialId: number): Solucao[] {
  return (conectar().prepare("SELECT * FROM solucoes WHERE material_id = ? ORDER BY id DESC").all(materialId) as Linha[]).map(
    comCategorias,
  );
}

export function contagemPorCategoria(): Record<string, { incorporadas: number; propostas: number }> {
  const linhas = conectar()
    .prepare(
      `SELECT sc.categoria AS categoria,
        SUM(s.situacao = 'Incorporada') AS incorporadas,
        SUM(s.situacao = 'Proposta') AS propostas
       FROM solucao_categorias sc JOIN solucoes s ON s.id = sc.solucao_id GROUP BY sc.categoria`,
    )
    .all() as { categoria: string; incorporadas: number; propostas: number }[];
  const mapa: Record<string, { incorporadas: number; propostas: number }> = {};
  for (const slug of SLUGS) mapa[slug] = { incorporadas: 0, propostas: 0 };
  for (const l of linhas) mapa[l.categoria] = { incorporadas: l.incorporadas, propostas: l.propostas };
  return mapa;
}

export function totais(): { incorporadas: number; propostas: number } {
  const r = conectar()
    .prepare(
      "SELECT COALESCE(SUM(situacao = 'Incorporada'), 0) AS incorporadas, COALESCE(SUM(situacao = 'Proposta'), 0) AS propostas FROM solucoes",
    )
    .get() as { incorporadas: number; propostas: number };
  return r;
}

export function criarSolucao(d: {
  titulo: string;
  tipo: string;
  descricao: string;
  origem: string;
  materialId: number | null;
  estado: string;
  limitacoes: string;
  categorias: string[];
  nivel?: Nivel | null;
  chaveOrigem?: string | null;
  ficha?: Ficha;
}): number {
  const titulo = d.titulo.trim();
  if (d.nivel && !NIVEIS.includes(d.nivel)) throw new Error("Nível inválido.");
  const origem = d.origem.trim();
  const cats = [...new Set(d.categorias)];
  if (!titulo || titulo.length > 150) throw new Error("Informe um título de até 150 caracteres.");
  if (!origem || origem.length > 300) throw new Error("A origem é obrigatória, com até 300 caracteres.");
  if (!(TIPOS_SOLUCAO as readonly string[]).includes(d.tipo)) throw new Error("Tipo inválido.");
  if (!ESTADOS_INICIAIS.includes(d.estado as (typeof ESTADOS_INICIAIS)[number]))
    throw new Error("Para propor, escolha um estado sem validação. A validação exige evidência e vem depois.");
  if (cats.length === 0 || cats.some((c) => !SLUGS.includes(c))) throw new Error("Escolha ao menos uma categoria válida.");
  if (d.descricao.length > 5000 || d.limitacoes.length > 3000) throw new Error("Texto longo demais.");

  const c = conectar();
  c.exec("BEGIN");
  try {
    const r = c
      .prepare(
        `INSERT INTO solucoes (titulo, tipo, descricao, origem, material_id, estado, limitacoes, nivel, chave_origem, resumo, pilar, explicacao, justificativa_nivel, nivel_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        titulo, d.tipo, d.descricao.trim(), origem, d.materialId, d.estado, d.limitacoes.trim(), d.nivel ?? null, d.chaveOrigem ?? null,
        d.ficha?.resumo ?? "", d.ficha?.pilar ?? "", d.ficha?.explicacao ?? "", d.ficha?.justificativaNivel ?? "", d.nivel ? (d.ficha?.nivelPor ?? "Usuário") : "",
      );
    const id = Number(r.lastInsertRowid);
    const ins = c.prepare("INSERT INTO solucao_categorias (solucao_id, categoria, principal) VALUES (?, ?, ?)");
    cats.forEach((cat, i) => ins.run(id, cat, i === 0 ? 1 : 0));
    c.prepare("INSERT INTO aprovacoes (tipo, titulo, origem, solucao_id) VALUES ('Solução', ?, ?, ?)").run(
      `Incorporar à Biblioteca: ${titulo}`,
      origem,
      id,
    );
    c.exec("COMMIT");
    registrar(`Solução proposta: ${titulo} (${cats.length} categoria(s))`);
    return id;
  } catch (e) {
    c.exec("ROLLBACK");
    throw e;
  }
}

export type BaseSolucao = {
  titulo: string;
  tipo: string;
  descricao: string;
  origem: string;
  materialId: number | null;
  limitacoes: string;
  categorias: string[];
  nivel: Nivel | null;
  chaveOrigem: string;
  estado?: string;
  ficha?: Ficha;
};

// Incorpora de uma vez conteúdo que o PRÓPRIO usuário forneceu e mandou carregar. O registro de aprovação
// fica gravado como decidida, e o histórico diz que a autorização veio de instrução direta do usuário.
// Idempotente: a mesma chave de origem nunca entra duas vezes. Devolve true quando entrou.
export function incorporarDoUsuario(d: BaseSolucao): boolean {
  const titulo = d.titulo.trim();
  const origem = d.origem.trim();
  const cats = [...new Set(d.categorias)];
  if (!titulo || !origem || cats.length === 0 || cats.some((c) => !SLUGS.includes(c))) throw new Error(`Conteúdo-base inválido: ${titulo || "(sem título)"}`);
  if (d.nivel && !NIVEIS.includes(d.nivel)) throw new Error("Nível inválido.");
  const c = conectar();
  if (c.prepare("SELECT 1 FROM solucoes WHERE chave_origem = ?").get(d.chaveOrigem)) return false;
  c.exec("BEGIN");
  try {
    const r = c
      .prepare(
        `INSERT INTO solucoes (titulo, tipo, descricao, origem, material_id, estado, limitacoes, situacao, nivel, chave_origem, resumo, pilar, explicacao, justificativa_nivel, nivel_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Incorporada', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        titulo.slice(0, 150), d.tipo, d.descricao.trim(), origem.slice(0, 300), d.materialId, d.estado ?? "Analisado", d.limitacoes.trim(), d.nivel, d.chaveOrigem,
        d.ficha?.resumo ?? "", d.ficha?.pilar ?? "", d.ficha?.explicacao ?? "", d.ficha?.justificativaNivel ?? "", d.nivel ? (d.ficha?.nivelPor ?? "Documento") : "",
      );
    const id = Number(r.lastInsertRowid);
    const ins = c.prepare("INSERT INTO solucao_categorias (solucao_id, categoria, principal) VALUES (?, ?, ?)");
    cats.forEach((cat, i) => ins.run(id, cat, i === 0 ? 1 : 0)); // a primeira categoria é a principal
    const ap = c
      .prepare("INSERT INTO aprovacoes (tipo, titulo, origem, solucao_id, estado, decidido_em) VALUES ('Solução', ?, ?, ?, 'Aprovada', datetime('now','localtime'))")
      .run(`Incorporar à Biblioteca: ${titulo.slice(0, 120)}`, origem.slice(0, 300), id);
    c.prepare("INSERT INTO incorporacoes (solucao_id, aprovacao_id) VALUES (?, ?)").run(id, Number(ap.lastInsertRowid));
    c.exec("COMMIT");
    return true;
  } catch (e) {
    c.exec("ROLLBACK");
    throw e;
  }
}

export function contagemNiveis(categoria: string): Record<Nivel | "sem", number> {
  const linhas = conectar()
    .prepare(
      `SELECT s.nivel AS nivel, COUNT(*) AS n FROM solucoes s JOIN solucao_categorias sc ON sc.solucao_id = s.id
       WHERE sc.categoria = ? AND s.situacao = 'Incorporada' GROUP BY s.nivel`,
    )
    .all(categoria) as { nivel: Nivel | null; n: number }[];
  const r: Record<Nivel | "sem", number> = { BASE: 0, SÊNIOR: 0, STAFF: 0, sem: 0 };
  for (const l of linhas) r[l.nivel ?? "sem"] = l.n;
  return r;
}

// O nível é decisão do usuário. Com nível, a solução passa a poder ser escolhida como requisito nos projetos.
export function definirNivel(solucaoId: number, nivel: string) {
  const s = obterSolucao(solucaoId);
  if (!s) throw new Error("Solução não encontrada.");
  if (nivel !== "" && !(NIVEIS as string[]).includes(nivel)) throw new Error("Nível inválido.");
  const novo = nivel === "" ? null : (nivel as Nivel);
  if (s.nivel === novo) return;
  // Uma escolha do usuário nunca é desfeita depois por uma sugestão da IA.
  conectar().prepare("UPDATE solucoes SET nivel = ?, nivel_por = ? WHERE id = ?").run(novo, novo ? "Usuário" : "", solucaoId);
  registrar(`Nível de "${s.titulo}": ${s.nivel ? ROTULO_NIVEL[s.nivel] : "sem nível"} para ${novo ? ROTULO_NIVEL[novo] : "sem nível"}`);
}

export type FichaIA = { resumo: string; pilar: string; nivel: Nivel | null; justificativaNivel: string; explicacao: string; titulo?: string };

// Grava a ficha gerada pela IA. O nível só é trocado se ainda não foi decidido pelo usuário nem veio do documento dele.
export function aplicarFicha(solucaoId: number, f: FichaIA): { nivelAplicado: boolean } {
  const s = obterSolucao(solucaoId);
  if (!s) throw new Error("Solução não encontrada.");
  const podeNivel = s.nivel_por === "" || s.nivel_por === "IA";
  conectar()
    .prepare(
      `UPDATE solucoes SET resumo = ?, pilar = ?, explicacao = ?, justificativa_nivel = ?,
        nivel = CASE WHEN ? THEN ? ELSE nivel END, nivel_por = CASE WHEN ? THEN ? ELSE nivel_por END WHERE id = ?`,
    )
    .run(f.resumo, f.pilar, f.explicacao, f.justificativaNivel, podeNivel ? 1 : 0, f.nivel, podeNivel ? 1 : 0, f.nivel ? "IA" : "", solucaoId);
  // Propostas vindas de outros sistemas ganham um título genérico, sem trechos específicos do sistema de origem.
  const novoTitulo = (f.titulo ?? "").trim();
  if (novoTitulo && novoTitulo.length <= 150 && novoTitulo !== s.titulo && s.chave_origem && /^(estudo|chat):/.test(s.chave_origem)) {
    const c = conectar();
    c.prepare("UPDATE solucoes SET titulo = ? WHERE id = ?").run(novoTitulo, solucaoId);
    c.prepare("UPDATE aprovacoes SET titulo = ? WHERE solucao_id = ? AND tipo = 'Solução'").run(`Incorporar à Biblioteca: ${novoTitulo.slice(0, 120)}`, solucaoId);
    registrar(`Título refeito: "${s.titulo}" para "${novoTitulo}"`);
  }
  // O texto novo também entra na busca.
  conectar()
    .prepare("INSERT INTO busca (tipo, ref_id, projeto_id, texto) VALUES ('solucao', ?, 0, ?)")
    .run(solucaoId, `${novoTitulo || s.titulo} ${f.resumo} ${f.explicacao}`);
  return { nivelAplicado: podeNivel };
}

export function chavesDe(ids: number[]): Map<number, string | null> {
  const mapa = new Map<number, string | null>();
  if (ids.length === 0) return mapa;
  const linhas = conectar()
    .prepare(`SELECT id, chave_origem FROM solucoes WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as { id: number; chave_origem: string | null }[];
  for (const l of linhas) mapa.set(l.id, l.chave_origem);
  return mapa;
}

export function solucaoPorTitulo(titulo: string): Solucao | undefined {
  const l = conectar().prepare("SELECT * FROM solucoes WHERE lower(titulo) = lower(?) AND situacao = 'Incorporada' ORDER BY id LIMIT 1").get(titulo.trim()) as Linha | undefined;
  return l && comCategorias(l);
}

export function titulosIncorporados(): string[] {
  return (conectar().prepare("SELECT titulo FROM solucoes WHERE situacao = 'Incorporada' ORDER BY id").all() as { titulo: string }[]).map((r) => r.titulo);
}

// Auto-ingestão: a proposta entra na Biblioteca já aprovada. O registro de aprovação e o histórico dizem que foi automático.
export function incorporarAutomatico(solucaoId: number, origem: string): boolean {
  const c = conectar();
  const ap = c.prepare("SELECT id FROM aprovacoes WHERE solucao_id = ? AND tipo = 'Solução' AND estado = 'Pendente' ORDER BY id DESC LIMIT 1").get(solucaoId) as { id: number } | undefined;
  if (!ap) return false;
  const ok = decidirAprovacao(ap.id, "Aprovada");
  if (ok) registrar(`Auto-ingestão (${origem}): solução ${solucaoId} incorporada sem revisão manual`);
  return ok;
}

export function listarEvidencias(solucaoId: number): Evidencia[] {
  return conectar().prepare("SELECT * FROM evidencias WHERE solucao_id = ? ORDER BY id").all(solucaoId) as Evidencia[];
}

export function adicionarEvidencia(solucaoId: number, descricao: string, referencia: string) {
  const d = descricao.trim();
  if (!d || d.length > 1500 || referencia.length > 300) throw new Error("Descreva a evidência em até 1500 caracteres.");
  const s = obterSolucao(solucaoId);
  if (!s) throw new Error("Solução não encontrada.");
  conectar().prepare("INSERT INTO evidencias (solucao_id, descricao, referencia) VALUES (?, ?, ?)").run(solucaoId, d, referencia.trim());
  registrar(`Evidência registrada em: ${s.titulo}`);
}

export function alterarEstado(solucaoId: number, estado: string) {
  if (!(ESTADOS_VALIDACAO as readonly string[]).includes(estado)) throw new Error("Estado inválido.");
  const s = obterSolucao(solucaoId);
  if (!s) throw new Error("Solução não encontrada.");
  if (ESTADOS_COM_EVIDENCIA.includes(estado) && listarEvidencias(solucaoId).length === 0)
    throw new Error("Registre ao menos uma evidência antes de marcar como validada.");
  conectar().prepare("UPDATE solucoes SET estado = ? WHERE id = ?").run(estado, solucaoId);
  registrar(`Estado de "${s.titulo}": ${s.estado} para ${estado}`);
}
