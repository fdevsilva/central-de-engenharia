import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { obterMaterialPorHash, ultimaVersao, registrarMaterial, registrar } from "./db";

export const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const EXT_TEXTO = [".txt", ".md", ".json", ".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".sql", ".csv", ".yml", ".yaml"];
const EXT_BINARIO = [".pdf", ".docx", ".zip", ".png", ".jpg", ".jpeg", ".webp"];

export type ResultadoIngestao =
  | { situacao: "recebido"; id: number; versao: number; conflito: boolean }
  | { situacao: "duplicado"; id: number }
  | { situacao: "recusado"; motivo: string };

// Sugestão automática por palavras-chave: só orienta. Quem decide a categoria é o usuário.
const PALAVRAS: Record<string, string[]> = {
  seguranca: ["segurança", "autenticação", "csrf", "xss", "rls", "hmac", "senha", "token", "idor", "segredos"],
  "desempenho-seo": ["seo", "lcp", "pagespeed", "sitemap", "canonical", "core web vitals", "lighthouse", "ttfb", "metadata"],
  "padroes-arquitetura": ["arquitetura", "multi-tenant", "multitenant", "modularidade", "componentes reutilizáveis"],
  "motor-imagens": ["webp", "avif", "imagem", "imagens", "redimensionamento", "srcset"],
  "testes-qualidade": ["teste", "testes", "regressão", "ponta a ponta", "critério de aceite"],
  "banco-dados": ["banco de dados", "migração", "migrações", "índice", "transação", "postgres", "supabase"],
  "integracoes-apis": ["webhook", "api externa", "pagamento", "mercado pago", "resend", "idempotência"],
  "implantacao-automacao": ["deploy", "implantação", "vercel", "github actions", "variável de ambiente", "ci/cd"],
  "interface-acessibilidade": ["acessibilidade", "contraste", "aria", "teclado", "leitor de tela", "responsividade"],
  "monitoramento-confiabilidade": ["monitoramento", "alerta", "disponibilidade", "log de erro", "observabilidade"],
  "ia-automacao-engenharia": ["claude code", "agente", "prompt", "contexto persistente"],
  "procedimentos-diagnostico": ["diagnóstico", "causa raiz", "auditoria", "checklist", "lista de verificação", "roteiro"],
  "documentacao-conhecimento": ["documentação do projeto", "livro de projeto", "livro-do-projeto", "dossiê", "esqueleto", "log cronológico", "decisões"],
};

function nomeSeguro(nome: string): string {
  return path.basename(nome).replace(/[^\w.\- ]/g, "_").slice(0, 120) || "arquivo";
}

function classificar(texto: string, nome: string): string {
  // O nome do arquivo pesa mais que uma menção isolada no conteúdo.
  const t = `${texto} ${`${nome} `.repeat(5)}`.toLowerCase();
  let melhor = "";
  let pontos = 0;
  for (const [slug, palavras] of Object.entries(PALAVRAS)) {
    const n = palavras.reduce((s, p) => s + t.split(p).length - 1, 0);
    if (n > pontos) {
      pontos = n;
      melhor = slug;
    }
  }
  return melhor;
}

function topicos(texto: string): string[] {
  const lista: string[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.trim();
    if (!l || /^[=#\-*_]{3,}$/.test(l)) continue;
    const ehTitulo =
      /^#{1,3}\s+\S/.test(l) ||
      /^\d+(\.\d+)*[.)]?\s+[A-ZÀ-Ú]/.test(l) ||
      /^(PARTE|ETAPA|SEÇÃO)\b/i.test(l) ||
      (/^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ,.\-:()/&]{10,90}$/.test(l) && !/[a-zà-ú]/.test(l));
    if (ehTitulo && l.length <= 100) lista.push(l.replace(/^#+\s*/, ""));
    if (lista.length >= 15) break;
  }
  return lista;
}

export function ingerir(nomeOriginal: string, bytes: Buffer): ResultadoIngestao {
  const nome = nomeSeguro(nomeOriginal);
  const ext = path.extname(nome).toLowerCase();
  const texto = EXT_TEXTO.includes(ext);
  if (!texto && !EXT_BINARIO.includes(ext)) return { situacao: "recusado", motivo: `Formato não aceito: ${ext || "sem extensão"}` };
  if (bytes.length === 0) return { situacao: "recusado", motivo: "Arquivo vazio" };
  if (bytes.length > TAMANHO_MAXIMO) return { situacao: "recusado", motivo: "Arquivo maior que 5 MB" };
  if (texto && bytes.includes(0)) return { situacao: "recusado", motivo: "Conteúdo binário em arquivo de texto" };

  const hash = createHash("sha256").update(bytes).digest("hex");
  const existente = obterMaterialPorHash(hash);
  if (existente) {
    registrar(`Material repetido ignorado: ${nome} (já existe como ${existente.nome})`);
    return { situacao: "duplicado", id: existente.id };
  }

  const dir = path.join(process.cwd(), "data", "originais");
  mkdirSync(dir, { recursive: true });
  const caminho = path.join(dir, `${hash.slice(0, 12)}-${nome}`);
  writeFileSync(caminho, bytes, { flag: "wx" });
  chmodSync(caminho, 0o444);

  const anterior = ultimaVersao(nome);
  const versao = anterior ? anterior.versao + 1 : 1;
  const conflito = !!anterior;
  const conteudo = texto ? bytes.toString("utf8") : "";
  const analise = texto
    ? {
        linhas: conteudo.split(/\r?\n/).length,
        palavras: conteudo.split(/\s+/).filter(Boolean).length,
        categoria: classificar(conteudo, nome),
        topicos: topicos(conteudo),
      }
    : { linhas: 0, palavras: 0, categoria: "", topicos: [] as string[] };

  const observacao = conflito
    ? `Conteúdo diferente da versão ${anterior!.versao} do mesmo arquivo. As duas versões foram preservadas. Decida qual vale para uso atual.`
    : texto
      ? ""
      : "Formato sem análise de texto. Apenas preservado.";

  const id = registrarMaterial({
    nome,
    hash,
    tamanho: bytes.length,
    extensao: ext,
    caminho,
    versao,
    estado: conflito ? "Conflitante" : texto ? "Analisado" : "Recebido",
    observacao,
    analise,
  });
  return { situacao: "recebido", id, versao, conflito };
}
