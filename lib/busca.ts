import { conectar } from "./db";

export type TipoResultado = "solucao" | "material";

export type Resultado = {
  tipo: TipoResultado;
  refId: number;
  projetoId: number;
  titulo: string;
  detalhe: string;
  href: string;
  trecho: string;
  antiga: boolean;
};

const IGNORAR = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre e ou mas que se como qual quais quem onde quando foi era ser sao esta estao tem ha ja nao mais muito so ate isso isto esse essa este aquilo ele ela eles elas eu nos voce voces meu minha seu sua nosso nossa ao aos pelo pela pelos pelas me te lhe vai vamos fazer feito qual".split(" "),
);

// Transforma a pergunta numa consulta FTS5 segura: palavras com prefixo, unidas por OU, ordenadas por relevância.
export function consultaFts(q: string): string | null {
  const termos = (q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length >= 2 && !IGNORAR.has(t),
  );
  const unicos = [...new Set(termos)].slice(0, 12);
  return unicos.length ? unicos.map((t) => `"${t}"*`).join(" OR ") : null;
}

// Para textos longos colados pelo usuário: usa os termos mais característicos (mais frequentes e mais longos).
export function consultaFtsLonga(texto: string, maxTermos = 14): string | null {
  const palavras = (texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length >= 4 && !IGNORAR.has(t),
  );
  const freq = new Map<string, number>();
  for (const p of palavras) freq.set(p, (freq.get(p) ?? 0) + 1);
  const termos = [...freq.entries()]
    .sort((a, b) => b[1] * Math.min(b[0].length, 10) - a[1] * Math.min(a[0].length, 10))
    .slice(0, maxTermos)
    .map(([t]) => t);
  return termos.length ? termos.map((t) => `"${t}"*`).join(" OR ") : null;
}

export function partirTrecho(s: string): { texto: string; destaque: boolean }[] {
  return s
    .split(/(\[\[.*?\]\])/g)
    .filter(Boolean)
    .map((p) => (p.startsWith("[[") && p.endsWith("]]") ? { texto: p.slice(2, -2), destaque: true } : { texto: p, destaque: false }));
}

type Bruto = { tipo: TipoResultado; ref_id: number; projeto_id: number; trecho: string };

export function buscar(q: string, opcoes: { projetoId?: number; tipos?: TipoResultado[]; limite?: number } = {}): Resultado[] {
  const fts = consultaFts(q);
  if (!fts) return [];
  const limite = Math.min(opcoes.limite ?? 30, 300);
  const onde: string[] = ["busca MATCH ?"];
  const args: (string | number)[] = [fts];
  if (opcoes.projetoId) {
    onde.push("projeto_id = ?");
    args.push(opcoes.projetoId);
  }
  if (opcoes.tipos?.length) {
    onde.push(`tipo IN (${opcoes.tipos.map(() => "?").join(",")})`);
    args.push(...opcoes.tipos);
  }
  const brutos = conectar()
    .prepare(
      `SELECT tipo, ref_id, projeto_id, snippet(busca, 3, '[[', ']]', '…', 16) AS trecho
       FROM busca WHERE ${onde.join(" AND ")} ORDER BY bm25(busca) LIMIT ?`,
    )
    .all(...args, limite * 3) as Bruto[];

  const c = conectar();
  const vistos = new Set<string>();
  const saida: Resultado[] = [];
  for (const b of brutos) {
    const chave = `${b.tipo}:${b.ref_id}`;
    if (vistos.has(chave)) continue;
    let r: Resultado | null = null;

    if (b.tipo === "solucao") {
      const s = c.prepare("SELECT id, titulo, estado FROM solucoes WHERE id = ?").get(b.ref_id) as
        | { id: number; titulo: string; estado: string }
        | undefined;
      if (s) r = { tipo: "solucao", refId: s.id, projetoId: 0, antiga: false, trecho: b.trecho, titulo: s.titulo, detalhe: `Solução da Biblioteca · ${s.estado}`, href: `/biblioteca/solucoes/${s.id}` };
    } else if (b.tipo === "material") {
      const m = c.prepare("SELECT id, nome, versao FROM materiais WHERE id = ?").get(b.ref_id) as
        | { id: number; nome: string; versao: number }
        | undefined;
      if (m) r = { tipo: "material", refId: m.id, projetoId: 0, antiga: false, trecho: b.trecho, titulo: m.nome, detalhe: `Material recebido · versão ${m.versao}`, href: `/biblioteca/${m.id}` };
    }
    if (!r) continue;
    vistos.add(chave);
    saida.push(r);
    if (saida.length >= limite) break;
  }
  return saida;
}
