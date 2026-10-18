import { conectar, registrar } from "./db";
import { perguntar } from "./claude";
import { aplicarFicha, NIVEIS, ROTULO_NIVEL, type FichaIA, type Nivel } from "./solucoes";
import { nomeCategoria } from "./categorias";
import { contemSegredoReal } from "./segredos";
import { CAMPOS_FICHA, FORMATO_CAMPOS_FICHA, lerCamposFicha } from "./ficha-texto";

export const MODELO_FICHA = process.env.CENTRAL_MODELO_BIBLIOTECA || "sonnet";
const LOTE = 6;
const CHAVE_STATUS = "enriquecimento";

export type Status = { estado: "Em andamento" | "Concluído" | "Falhou"; total: number; feitos: number; niveis: number; erro: string; custo: number; iniciado: string };

export function lerStatus(): Status | null {
  const r = conectar().prepare("SELECT valor FROM configuracoes WHERE chave = ?").get(CHAVE_STATUS) as { valor: string } | undefined;
  if (!r) return null;
  const s = JSON.parse(r.valor) as Status;
  // Se a Central foi reiniciada no meio, o trabalho não continua sozinho.
  if (s.estado === "Em andamento" && Date.now() - new Date(s.iniciado).getTime() > 30 * 60_000) return { ...s, estado: "Falhou", erro: "Interrompido (a Central foi reiniciada)." };
  return s;
}
function gravarStatus(s: Status) {
  conectar().prepare("INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(CHAVE_STATUS, JSON.stringify(s));
}

type Item = { id: number; titulo: string; tipo: string; descricao: string; limitacoes: string; origem: string; cats: string; nivel: Nivel | null; nivel_por: string; chave_origem: string | null };
const ehDeOutroSistema = (chave: string | null) => !!chave && /^(estudo|chat):/.test(chave);

export function pendentesDeFicha(): Item[] {
  return conectar()
    .prepare(
      `SELECT s.id, s.titulo, s.tipo, s.descricao, s.limitacoes, s.origem, s.nivel, s.nivel_por, s.chave_origem,
        (SELECT group_concat(categoria, ',') FROM solucao_categorias WHERE solucao_id = s.id) AS cats
       FROM solucoes s WHERE s.explicacao NOT LIKE '%Por que existe: %' AND s.situacao IN ('Proposta','Incorporada') ORDER BY s.id`,
    )
    .all() as Item[];
}

// Exemplos que o próprio usuário já classificou, para a IA calibrar o nível pelo critério dele.
function exemplosDoUsuario(): string {
  const linhas = conectar().prepare("SELECT titulo, nivel FROM solucoes WHERE nivel_por = 'Documento' ORDER BY id").all() as { titulo: string; nivel: Nivel }[];
  const saida: string[] = [];
  for (const n of NIVEIS) {
    const doNivel = linhas.filter((l) => l.nivel === n);
    const passo = Math.max(1, Math.floor(doNivel.length / 10));
    for (let i = 0; i < doNivel.length && saida.filter((s) => s.startsWith(`${n}:`)).length < 10; i += passo) saida.push(`${n}: ${doNivel[i].titulo.slice(0, 110)}`);
  }
  return saida.join("\n");
}

export const INSTRUCOES_FICHA = `Você completa fichas de uma Biblioteca de Engenharia. Você recebe itens (id, título, tipo, categorias, descrição da fonte) e devolve a ficha completa de cada um.
${CAMPOS_FICHA}
Português do Brasil, sem travessão longo.
Itens marcados como "NÍVEL JÁ DEFINIDO" têm o nível decidido pelo usuário: repita esse nível em "nivel" e use "justificativa_nivel" para explicar por que ele faz sentido. Itens marcados como "VINDO DE OUTRO SISTEMA" levam também "titulo": um título genérico e reutilizável da prática (até 120 caracteres), sem nome de sistema, empresa, tabela, arquivo, função ou variável específicos. Os demais itens não levam "titulo".
Responda APENAS com um JSON: [{"id":0,"titulo":"",${FORMATO_CAMPOS_FICHA}}]`;

export function montarEntrada(itens: Item[]): string {
  const blocos = itens.map((i) => {
    const fixo = i.nivel && (i.nivel_por === "Documento" || i.nivel_por === "Usuário") ? `\nNÍVEL JÁ DEFINIDO: ${i.nivel}` : "";
    const outro = ehDeOutroSistema(i.chave_origem) ? "\nVINDO DE OUTRO SISTEMA (refaça o título de forma genérica)" : "";
    return `### id ${i.id} | ${i.tipo} | ${i.cats.split(",").map(nomeCategoria).join(", ")}${fixo}${outro}\nTítulo: ${i.titulo}\nDescrição da fonte: ${i.descricao.replace(/\s+/g, " ").slice(0, 1600)}`;
  });
  return `EXEMPLOS DE NÍVEL QUE O USUÁRIO JÁ DEFINIU NOS DOCUMENTOS DELE:\n${exemplosDoUsuario()}\n\nITENS PARA COMPLETAR:\n\n${blocos.join("\n\n")}`;
}

export function lerFichas(resposta: string, idsValidos: Set<number>, comTitulo: Set<number> = new Set()): { fichas: Map<number, FichaIA>; descartes: string[] } {
  const ini = resposta.indexOf("[");
  const fim = resposta.lastIndexOf("]");
  if (ini < 0 || fim <= ini) throw new Error("A IA não devolveu um JSON utilizável.");
  let lista: unknown;
  try {
    lista = JSON.parse(resposta.slice(ini, fim + 1));
  } catch {
    throw new Error("A IA devolveu um JSON inválido.");
  }
  if (!Array.isArray(lista)) throw new Error("A IA devolveu um formato inesperado.");
  const fichas = new Map<number, FichaIA>();
  const descartes: string[] = [];
  for (const x of lista) {
    const o = (x ?? {}) as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isInteger(id) || !idsValidos.has(id)) { descartes.push(`id ${String(o.id)}: não é um item deste lote`); continue; }
    if (fichas.has(id)) { descartes.push(`id ${id}: repetido`); continue; }
    const lida = lerCamposFicha(o);
    if (!lida.ficha) { descartes.push(`id ${id}: ${lida.problema}`); continue; }
    const t = typeof o.titulo === "string" ? o.titulo.replace(/\s+/g, " ").trim() : "";
    fichas.set(id, comTitulo.has(id) && t && !contemSegredoReal(t) ? { ...lida.ficha, titulo: t } : lida.ficha);
  }
  return { fichas, descartes };
}

export function iniciarEnriquecimento(): number {
  const atual = lerStatus();
  if (atual?.estado === "Em andamento") throw new Error("Já existe um enriquecimento em andamento.");
  const itens = pendentesDeFicha();
  if (itens.length === 0) throw new Error("Não há itens sem ficha completa.");
  gravarStatus({ estado: "Em andamento", total: itens.length, feitos: 0, niveis: 0, erro: "", custo: 0, iniciado: new Date().toISOString() });
  registrar(`Enriquecimento iniciado: ${itens.length} item(ns) para ficha completa`);
  void executar(itens).catch((e) => {
    const s = lerStatus();
    if (s) gravarStatus({ ...s, estado: "Falhou", erro: e instanceof Error ? e.message : "Erro inesperado." });
  });
  return itens.length;
}

async function executar(itens: Item[]) {
  let feitos = 0, niveis = 0, custo = 0;
  const falhas: string[] = [];
  for (let i = 0; i < itens.length; i += LOTE) {
    const lote = itens.slice(i, i + LOTE);
    const ids = new Set(lote.map((l) => l.id));
    try {
      const comTitulo = new Set(lote.filter((l) => ehDeOutroSistema(l.chave_origem)).map((l) => l.id));
      let lido: ReturnType<typeof lerFichas> | null = null;
      // Se o JSON vier quebrado, o lote é pedido mais uma vez antes de ser dado como falho.
      for (let tentativa = 0; tentativa < 2 && !lido; tentativa++) {
        const r = await perguntar(montarEntrada(lote), undefined, INSTRUCOES_FICHA, { semSessao: true, modelo: MODELO_FICHA, tempoMaximoMs: 10 * 60_000 });
        custo += r.custo ?? 0;
        try {
          lido = lerFichas(r.texto, ids, comTitulo);
        } catch (e) {
          if (tentativa === 1) throw e;
        }
      }
      const { fichas, descartes } = lido!;
      for (const [id, f] of fichas) {
        const { nivelAplicado } = aplicarFicha(id, f);
        feitos++;
        if (nivelAplicado && f.nivel) niveis++;
      }
      falhas.push(...descartes);
    } catch (e) {
      falhas.push(`lote ${i / LOTE + 1}: ${e instanceof Error ? e.message : "erro"}`);
    }
    gravarStatus({ estado: "Em andamento", total: itens.length, feitos, niveis, erro: falhas.join(" | "), custo, iniciado: lerStatus()?.iniciado ?? new Date().toISOString() });
  }
  gravarStatus({ estado: feitos > 0 ? "Concluído" : "Falhou", total: itens.length, feitos, niveis, erro: falhas.join(" | "), custo, iniciado: lerStatus()?.iniciado ?? new Date().toISOString() });
  registrar(`Enriquecimento concluído: ${feitos} de ${itens.length} ficha(s), ${niveis} nível(is) definido(s) pela IA`);
}

export { ROTULO_NIVEL };
