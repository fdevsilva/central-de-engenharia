"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { obterProjeto, decidirAprovacao } from "../lib/db";
import { medir } from "../lib/medicoes";
import { carregarBibliotecaBase } from "../lib/biblioteca-base";
import { ocultarPrimeirosPassos } from "../lib/primeiros-passos";
import { iniciarEnriquecimento } from "../lib/enriquecimento";
import { criarChat, obterChat, conversar as conversarBiblioteca, incorporar as incorporarProposta, descartar as descartarProposta } from "../lib/biblioteca-chat";
import { autorizarPasta, autorizarRepositorioGithub, ehLinkGithub, revogarPasta, iniciarEstudo, propostasDoEstudo } from "../lib/estudo";
import { criarSolucao, adicionarEvidencia, alterarEstado, definirNivel } from "../lib/solucoes";
import { ingerir } from "../lib/ingestao";
import { iniciarRelatorio } from "../lib/relatorio";
import { iniciarAutoIngestao, type ArquivoTexto } from "../lib/auto-ingestao";

export async function enviarArquivos(formData: FormData) {
  const arquivos = formData.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length === 0 || arquivos.length > 20) redirect("/uploads?erro=1");
  let recebidos = 0;
  let duplicados = 0;
  let conflitos = 0;
  let recusados = 0;
  const paraLer: ArquivoTexto[] = [];
  for (const f of arquivos) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const r = ingerir(f.name, bytes);
    if (r.situacao === "recebido") {
      recebidos++;
      if (r.conflito) conflitos++;
      // Arquivos de texto novos passam pela leitura automática da IA.
      if (/\.(txt|md)$/i.test(f.name) && !bytes.includes(0)) paraLer.push({ nome: f.name, texto: bytes.toString("utf8"), materialId: r.id });
    } else if (r.situacao === "duplicado") duplicados++;
    else recusados++;
  }
  if (paraLer.length > 0) {
    try {
      iniciarAutoIngestao(paraLer);
      revalidatePath("/", "layout");
      redirect(`/uploads?lendo=1&recebidos=${recebidos}&duplicados=${duplicados}`);
    } catch (e) {
      // redirect() lança um sinal interno; qualquer outro erro vira aviso na tela de envio.
      if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
      if (typeof e === "object" && e && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      redirect(`/uploads?erro=${aviso(e)}`);
    }
  }
  redirect(`/biblioteca?recebidos=${recebidos}&duplicados=${duplicados}&conflitos=${conflitos}&recusados=${recusados}`);
}

function aviso(erro: unknown): string {
  return encodeURIComponent(erro instanceof Error ? erro.message : "Não foi possível concluir.");
}

export async function salvarSolucao(formData: FormData) {
  const materialBruto = Number(formData.get("material"));
  const materialId = Number.isInteger(materialBruto) && materialBruto > 0 ? materialBruto : null;
  let id: number | null = null;
  let erro: unknown = null;
  try {
    id = criarSolucao({
      titulo: String(formData.get("titulo") ?? ""),
      tipo: String(formData.get("tipo") ?? ""),
      descricao: String(formData.get("descricao") ?? ""),
      origem: String(formData.get("origem") ?? ""),
      materialId,
      estado: String(formData.get("estado") ?? ""),
      limitacoes: String(formData.get("limitacoes") ?? ""),
      categorias: formData.getAll("categorias").map(String),
      nivel: (String(formData.get("nivel") ?? "") || null) as "BASE" | "SÊNIOR" | "STAFF" | null,
    });
  } catch (e) {
    erro = e;
  }
  if (id === null) redirect(`/biblioteca/solucoes/manual?erro=${aviso(erro)}${materialId ? `&material=${materialId}` : ""}`);
  revalidatePath("/biblioteca");
  redirect(`/biblioteca/solucoes/${id}`);
}

export async function salvarEvidencia(formData: FormData) {
  const id = Number(formData.get("solucao"));
  if (!Number.isInteger(id)) return;
  let erro: unknown = null;
  try {
    adicionarEvidencia(id, String(formData.get("descricao") ?? ""), String(formData.get("referencia") ?? ""));
  } catch (e) {
    erro = e;
  }
  revalidatePath(`/biblioteca/solucoes/${id}`);
  redirect(`/biblioteca/solucoes/${id}${erro ? `?erro=${aviso(erro)}` : ""}`);
}

export async function mudarEstado(formData: FormData) {
  const id = Number(formData.get("solucao"));
  if (!Number.isInteger(id)) return;
  let erro: unknown = null;
  try {
    alterarEstado(id, String(formData.get("estado") ?? ""));
  } catch (e) {
    erro = e;
  }
  revalidatePath(`/biblioteca/solucoes/${id}`);
  redirect(`/biblioteca/solucoes/${id}${erro ? `?erro=${aviso(erro)}` : ""}`);
}

export async function decidir(formData: FormData) {
  const id = Number(formData.get("aprovacao"));
  const decisao = formData.get("decisao");
  if (!Number.isInteger(id) || (decisao !== "Aprovada" && decisao !== "Rejeitada")) return;
  decidirAprovacao(id, decisao);
  revalidatePath("/aprovacoes");
  revalidatePath("/biblioteca", "layout");
}

export async function medirSite(formData: FormData) {
  const projeto = obterProjeto(String(formData.get("_projeto") ?? ""));
  if (!projeto) return;
  let erro: unknown = null;
  try {
    await medir({
      projetoId: projeto.id,
      url: String(formData.get("url") ?? ""),
      dispositivo: String(formData.get("dispositivo") ?? ""),
      pagina: String(formData.get("pagina") ?? ""),
      rotulo: String(formData.get("rotulo") ?? ""),
      repeticoes: formData.get("tres") ? 3 : 1,
    });
  } catch (e) {
    erro = e;
  }
  revalidatePath("/pagespeed");
  redirect(`/pagespeed${erro ? `?erro=${aviso(erro)}` : ""}`);
}

export async function autorizarPastaAcao(formData: FormData) {
  let erro: unknown = null;
  try {
    const entrada = String(formData.get("caminho") ?? "");
    // Link de repositório público do GitHub (de terceiros) ou caminho de uma pasta local.
    if (ehLinkGithub(entrada)) await autorizarRepositorioGithub(entrada);
    else autorizarPasta(entrada);
  } catch (e) {
    erro = e;
  }
  revalidatePath("/repositorios");
  redirect(`/repositorios${erro ? `?erro=${aviso(erro)}` : "?ok=1"}`);
}

export async function revogarPastaAcao(formData: FormData) {
  const id = Number(formData.get("pasta"));
  let erro: unknown = null;
  try {
    if (!Number.isInteger(id)) throw new Error("Pasta inválida.");
    revogarPasta(id);
  } catch (e) {
    erro = e;
  }
  revalidatePath("/repositorios");
  redirect(`/repositorios${erro ? `?erro=${aviso(erro)}` : ""}`);
}

export async function iniciarEstudoAcao(formData: FormData) {
  const id = Number(formData.get("pasta"));
  let estudo: number | null = null;
  let erro: unknown = null;
  try {
    if (!Number.isInteger(id)) throw new Error("Pasta inválida.");
    estudo = iniciarEstudo(id);
  } catch (e) {
    erro = e;
  }
  revalidatePath("/repositorios");
  redirect(estudo ? `/estudos/${estudo}` : `/repositorios?erro=${aviso(erro)}`);
}

// Relatório de melhorias: só começa quando o usuário pede, escolhendo o nível e as categorias.
export async function iniciarRelatorioAcao(formData: FormData) {
  const pasta = Number(formData.get("pasta"));
  let relatorio: number | null = null;
  let erro: unknown = null;
  try {
    if (!Number.isInteger(pasta)) throw new Error("Repositório inválido.");
    relatorio = iniciarRelatorio(pasta, String(formData.get("nivel") ?? ""), formData.getAll("categoria").map(String));
  } catch (e) {
    erro = e;
  }
  revalidatePath("/repositorios");
  redirect(relatorio ? `/relatorios/${relatorio}` : `/relatorios/novo?pasta=${Number.isInteger(pasta) ? pasta : ""}&erro=${aviso(erro)}`);
}

export async function enviarMensagemBiblioteca(formData: FormData) {
  const bruto = Number(formData.get("chat"));
  let chat = Number.isInteger(bruto) && bruto > 0 && obterChat(bruto) ? bruto : criarChat();
  let erro: unknown = null;
  const texto = String(formData.get("msg") ?? "");
  // Texto grande demais para uma única chamada da IA (ela estouraria o tempo): vai pela leitura em trechos, com barra de progresso.
  if (texto.length > 1500) {
    try {
      const r = ingerir(`texto-colado-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.txt`, Buffer.from(texto, "utf8"));
      const materialId = r.situacao === "recusado" ? null : r.id;
      iniciarAutoIngestao([{ nome: "Texto colado", texto, materialId }]);
      revalidatePath("/", "layout");
    } catch (e) {
      erro = e;
    }
    redirect(erro ? `/biblioteca/solucoes/nova?chat=${chat}&erro=${aviso(erro)}` : "/uploads?lendo=1");
  }
  try {
    await conversarBiblioteca(chat, texto);
  } catch (e) {
    erro = e;
  }
  revalidatePath("/biblioteca", "layout");
  redirect(`/biblioteca/solucoes/nova?chat=${chat}${erro ? `&erro=${aviso(erro)}` : ""}`);
}

export async function incorporarPropostaChat(formData: FormData) {
  const proposta = Number(formData.get("proposta"));
  const chat = Number(formData.get("chat"));
  const principal = String(formData.get("principal") ?? "");
  const extras = formData.getAll("extras").map(String);
  let ok: number | null = null;
  let erro: unknown = null;
  try {
    if (!Number.isInteger(proposta)) throw new Error("Proposta inválida.");
    ok = incorporarProposta(proposta, {
      categorias: [principal, ...extras.filter((c) => c !== principal)],
      nivel: String(formData.get("nivel") ?? ""),
      origem: String(formData.get("origem") ?? ""),
      mesmoAssim: formData.get("mesmo") === "1",
    });
  } catch (e) {
    erro = e;
  }
  revalidatePath("/", "layout");
  redirect(`/biblioteca/solucoes/nova?chat=${chat}${ok ? `&incorporada=${ok}` : `&erro=${aviso(erro)}`}`);
}

export async function descartarPropostaChat(formData: FormData) {
  const proposta = Number(formData.get("proposta"));
  const chat = Number(formData.get("chat"));
  let erro: unknown = null;
  try {
    descartarProposta(proposta);
  } catch (e) {
    erro = e;
  }
  revalidatePath("/biblioteca", "layout");
  redirect(`/biblioteca/solucoes/nova?chat=${chat}${erro ? `&erro=${aviso(erro)}` : ""}`);
}

export async function acaoNivelSolucao(formData: FormData) {
  const id = Number(formData.get("solucao"));
  let erro: unknown = null;
  try {
    if (!Number.isInteger(id)) throw new Error("Solução inválida.");
    definirNivel(id, String(formData.get("nivel") ?? ""));
  } catch (e) {
    erro = e;
  }
  revalidatePath("/", "layout");
  redirect(`/biblioteca/solucoes/${id}${erro ? `?erro=${aviso(erro)}` : ""}`);
}

export async function iniciarEnriquecimentoAcao(formData: FormData) {
  const volta = String(formData.get("volta") ?? "");
  let erro: unknown = null;
  try {
    iniciarEnriquecimento();
  } catch (e) {
    erro = e;
  }
  revalidatePath("/", "layout");
  const destino = /^\/(estudos\/\d+|aprovacoes)$/.test(volta) ? volta : "/aprovacoes";
  redirect(`${destino}${erro ? `?erro=${aviso(erro)}` : ""}`);
}

export async function decidirNoEstudo(formData: FormData) {
  const estudo = Number(formData.get("estudo"));
  const aprovacao = Number(formData.get("aprovacao"));
  const decisao = formData.get("decisao");
  const solucao = Number(formData.get("solucao"));
  // O nível escolhido na revisão vale para qualquer decisão. Se for rejeitada, não faz diferença prática.
  if (Number.isInteger(solucao) && formData.has("nivel")) {
    try {
      definirNivel(solucao, String(formData.get("nivel") ?? ""));
    } catch {
      /* nível inválido é ignorado: a decisão de aprovar não deve falhar por isso */
    }
  }
  if (Number.isInteger(aprovacao) && (decisao === "Aprovada" || decisao === "Rejeitada")) decidirAprovacao(aprovacao, decisao);
  revalidatePath("/", "layout");
  redirect(`/estudos/${estudo}`);
}

export async function aprovarTodasDoEstudo(formData: FormData) {
  const estudo = Number(formData.get("estudo"));
  if (Number.isInteger(estudo)) {
    for (const p of propostasDoEstudo(estudo)) if (p.decisao === "Pendente") decidirAprovacao(p.aprovacao_id, "Aprovada");
  }
  revalidatePath("/", "layout");
  redirect(`/estudos/${estudo}`);
}

export async function carregarBibliotecaBaseAcao() {
  let r: { novos: number; jaExistiam: number; invalidos: number } | null = null;
  let erro: unknown = null;
  try {
    r = carregarBibliotecaBase();
  } catch (e) {
    erro = e;
  }
  revalidatePath("/", "layout");
  redirect(r ? `/biblioteca?base=${r.novos}.${r.jaExistiam}.${r.invalidos}` : `/biblioteca?erro=${aviso(erro)}`);
}

export async function ocultarPrimeirosPassosAcao(formData: FormData) {
  ocultarPrimeirosPassos(String(formData.get("ocultar")) !== "0");
  revalidatePath("/", "layout");
  redirect("/");
}

