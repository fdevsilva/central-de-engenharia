import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { conectar } from "./db";
import { incorporarDoUsuario, NIVEIS, type Nivel } from "./solucoes";
import { SLUGS, TIPOS_SOLUCAO } from "./categorias";

// Biblioteca base que acompanha a Central: um pacote JSON em conteudo/biblioteca-base.json.
// Carregar é seguro e repetível: cada item tem uma chave fixa, e o que já existe nunca é duplicado nem alterado.

type ItemPacote = {
  chave: string;
  titulo: string;
  tipo: string;
  categorias: string[];
  nivel: Nivel | null;
  nivelPor: "IA" | "Documento";
  descricao: string;
  limitacoes: string;
  origem: string;
  resumo: string;
  pilar: string;
  explicacao: string;
  justificativaNivel: string;
};

const CAMINHO = () => path.join(process.cwd(), "conteudo", "biblioteca-base.json");

function lerPacote(): ItemPacote[] | null {
  if (!existsSync(CAMINHO())) return null;
  try {
    const j = JSON.parse(readFileSync(CAMINHO(), "utf8")) as { itens?: ItemPacote[] };
    return Array.isArray(j.itens) ? j.itens : null;
  } catch {
    return null;
  }
}

export type EstadoBase = { disponivel: boolean; noPacote: number; carregados: number };

export function estadoBibliotecaBase(): EstadoBase {
  const itens = lerPacote();
  if (!itens) return { disponivel: false, noPacote: 0, carregados: 0 };
  const chaves = new Set(itens.map((i) => i.chave));
  const existentes = conectar().prepare("SELECT chave_origem FROM solucoes WHERE chave_origem LIKE 'base:%'").all() as { chave_origem: string }[];
  return { disponivel: true, noPacote: itens.length, carregados: existentes.filter((e) => chaves.has(e.chave_origem)).length };
}

export function carregarBibliotecaBase(): { novos: number; jaExistiam: number; invalidos: number } {
  const itens = lerPacote();
  if (!itens) throw new Error("O pacote conteudo/biblioteca-base.json não foi encontrado na pasta da Central.");
  let novos = 0, jaExistiam = 0, invalidos = 0;
  for (const i of itens) {
    const valido =
      typeof i.chave === "string" && /^base:[0-9a-f]{12}$/.test(i.chave) &&
      typeof i.titulo === "string" && i.titulo.trim().length > 0 && i.titulo.length <= 150 &&
      (TIPOS_SOLUCAO as readonly string[]).includes(i.tipo) &&
      Array.isArray(i.categorias) && i.categorias.length > 0 && i.categorias.every((c) => SLUGS.includes(c)) &&
      (i.nivel === null || (NIVEIS as string[]).includes(i.nivel));
    if (!valido) {
      invalidos++;
      continue;
    }
    try {
      const entrou = incorporarDoUsuario({
        titulo: i.titulo,
        tipo: i.tipo,
        descricao: String(i.descricao ?? ""),
        origem: String(i.origem ?? "Biblioteca base"),
        materialId: null,
        limitacoes: String(i.limitacoes ?? ""),
        categorias: i.categorias,
        nivel: i.nivel,
        chaveOrigem: i.chave,
        estado: "Recebido",
        ficha: {
          resumo: String(i.resumo ?? ""),
          pilar: String(i.pilar ?? ""),
          explicacao: String(i.explicacao ?? ""),
          justificativaNivel: String(i.justificativaNivel ?? ""),
          nivelPor: i.nivelPor === "IA" ? "IA" : "Documento",
        },
      });
      if (entrou) novos++;
      else jaExistiam++;
    } catch {
      invalidos++;
    }
  }
  return { novos, jaExistiam, invalidos };
}
