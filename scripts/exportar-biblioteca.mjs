// Exporta a Biblioteca de Engenharia do seu banco como um pacote JSON que outras pessoas podem importar.
// Uso: node scripts/exportar-biblioteca.mjs [saida.json]
// O pacote leva só o conteúdo dos itens (título, nível, categorias e ficha). Não leva evidências, aprovações,
// materiais enviados, histórico nem nomes de projetos: a origem de cada item é trocada por um texto genérico.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";

const banco = "data/central.db";
if (!existsSync(banco)) {
  console.error("Não encontrei data/central.db. Rode este comando na pasta da Central.");
  process.exit(1);
}
const saida = process.argv[2] ?? "conteudo/biblioteca-base.json";
const d = new DatabaseSync(banco, { readOnly: true });

const linhas = d
  .prepare(
    `SELECT id, titulo, tipo, descricao, limitacoes, origem, chave_origem, nivel, nivel_por, resumo, pilar, explicacao, justificativa_nivel
     FROM solucoes WHERE situacao = 'Incorporada' ORDER BY id`,
  )
  .all();

function origemGenerica(l) {
  const tipo = String(l.chave_origem ?? "").split(":")[0];
  if (tipo === "fw") {
    const m = /seção \d+\.\s*(.+)$/i.exec(l.origem);
    return m ? `Biblioteca base, tema: ${m[1].trim()}` : "Biblioteca base, framework de engenharia";
  }
  if (tipo === "esq") return "Biblioteca base, documentação de projeto";
  if (tipo === "estudo") return "Biblioteca base, prática extraída de código real e conferida pela Central";
  return "Biblioteca base, conhecimento incorporado pelo autor";
}

const itens = linhas.map((l) => {
  const cats = d.prepare("SELECT categoria FROM solucao_categorias WHERE solucao_id = ? ORDER BY principal DESC, categoria").all(l.id).map((c) => c.categoria);
  return {
    chave: `base:${createHash("sha1").update(l.titulo.toLowerCase()).digest("hex").slice(0, 12)}`,
    titulo: l.titulo,
    tipo: l.tipo,
    categorias: cats,
    nivel: l.nivel,
    nivelPor: l.nivel_por === "IA" ? "IA" : "Documento",
    descricao: l.descricao,
    limitacoes: l.limitacoes,
    origem: origemGenerica(l),
    resumo: l.resumo,
    pilar: l.pilar,
    explicacao: l.explicacao,
    justificativaNivel: l.justificativa_nivel,
  };
});

writeFileSync(saida, JSON.stringify({ versao: 1, total: itens.length, itens }, null, 1) + "\n", "utf8");
console.log(`${itens.length} itens exportados para ${saida}`);
