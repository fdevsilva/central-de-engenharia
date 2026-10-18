import { conectar, registrar, criarProjeto } from "./db";

export type Medicao = {
  id: number;
  projeto_id: number;
  ferramenta: string;
  url: string;
  dispositivo: "mobile" | "desktop";
  pagina: string;
  rotulo: string;
  repeticoes: number;
  medido_em: string;
  nota_desempenho: number;
  nota_acessibilidade: number;
  nota_boas_praticas: number;
  nota_seo: number;
  lcp_s: number;
  fcp_s: number;
  tbt_ms: number;
  cls: number;
  speed_index_s: number;
  detalhes: string;
  criado_em: string;
};

export type Leitura = {
  notas: { desempenho: number; acessibilidade: number; boasPraticas: number; seo: number };
  metricas: { lcp_s: number; fcp_s: number; tbt_ms: number; cls: number; speedIndex_s: number };
  versao: string;
  urlFinal: string;
};

export const FERRAMENTA = "PageSpeed Insights";
const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// A chave só existe no ambiente (arquivo .env.local, fora do Git). Aqui só se sabe se ela está configurada.
export function temChave(): boolean {
  return !!process.env.PAGESPEED_API_KEY?.trim();
}

// O Google acessa o site, não este computador. Mesmo assim, só endereços públicos fazem sentido.
export function validarUrlPublica(bruta: string): string {
  if (bruta.length > 300) throw new Error("Endereço longo demais.");
  let u: URL;
  try {
    u = new URL(bruta.trim());
  } catch {
    throw new Error("Endereço inválido. Use algo como https://exemplo.com.br");
  }
  const host = u.hostname;
  if (u.protocol !== "https:") throw new Error("Use um endereço https.");
  if (u.username || u.password) throw new Error("O endereço não pode conter usuário ou senha.");
  if (u.port && u.port !== "443") throw new Error("Use o endereço público padrão, sem porta.");
  if (!host.includes(".") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host === "localhost" || /\.(local|internal|lan)$/i.test(host))
    throw new Error("Só é possível medir um domínio público, não um IP ou endereço interno.");
  return u.toString();
}

export function paginaPadrao(url: string): string {
  try {
    const p = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return p === "" ? "home" : p.slice(0, 60);
  } catch {
    return "home";
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Lê o JSON do PageSpeed. Se faltar qualquer dado, recusa em vez de preencher com zero.
export function lerRespostaPSI(json: unknown): Leitura {
  const lr = (json as { lighthouseResult?: Record<string, unknown> } | null)?.lighthouseResult;
  if (!lr || typeof lr !== "object") throw new Error("Resposta do Google sem resultado de análise.");
  const erroExec = lr.runtimeError as { message?: string } | undefined;
  if (erroExec) throw new Error(`O Google não conseguiu analisar a página: ${String(erroExec.message ?? "erro desconhecido").slice(0, 200)}`);

  const cats = lr.categories as Record<string, { score?: number | null }> | undefined;
  const aud = lr.audits as Record<string, { numericValue?: number }> | undefined;
  const nota = (k: string): number => {
    const s = cats?.[k]?.score;
    if (typeof s !== "number" || s < 0 || s > 1) throw new Error(`Resposta incompleta do Google (falta a nota ${k}).`);
    return Math.round(s * 100);
  };
  const valor = (k: string): number => {
    const v = aud?.[k]?.numericValue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`Resposta incompleta do Google (falta a métrica ${k}).`);
    return v;
  };
  return {
    notas: { desempenho: nota("performance"), acessibilidade: nota("accessibility"), boasPraticas: nota("best-practices"), seo: nota("seo") },
    metricas: {
      lcp_s: r1(valor("largest-contentful-paint") / 1000),
      fcp_s: r1(valor("first-contentful-paint") / 1000),
      tbt_ms: Math.round(valor("total-blocking-time")),
      cls: r3(valor("cumulative-layout-shift")),
      speedIndex_s: r1(valor("speed-index") / 1000),
    },
    versao: String(lr.lighthouseVersion ?? ""),
    urlFinal: String(lr.finalUrl ?? ""),
  };
}

export function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function consolidar(leituras: Leitura[]): Leitura {
  const med = (f: (l: Leitura) => number) => mediana(leituras.map(f));
  return {
    notas: {
      desempenho: Math.round(med((l) => l.notas.desempenho)),
      acessibilidade: Math.round(med((l) => l.notas.acessibilidade)),
      boasPraticas: Math.round(med((l) => l.notas.boasPraticas)),
      seo: Math.round(med((l) => l.notas.seo)),
    },
    metricas: {
      lcp_s: r1(med((l) => l.metricas.lcp_s)),
      fcp_s: r1(med((l) => l.metricas.fcp_s)),
      tbt_ms: Math.round(med((l) => l.metricas.tbt_ms)),
      cls: r3(med((l) => l.metricas.cls)),
      speedIndex_s: r1(med((l) => l.metricas.speedIndex_s)),
    },
    versao: leituras[0].versao,
    urlFinal: leituras[0].urlFinal,
  };
}

async function chamarGoogle(url: string, dispositivo: string): Promise<Leitura> {
  const p = new URLSearchParams({ url, strategy: dispositivo });
  for (const c of ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"]) p.append("category", c);
  // A chave é opcional e vem só do ambiente. Nunca é gravada nem exibida.
  if (temChave()) p.set("key", process.env.PAGESPEED_API_KEY!.trim());
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?${p}`, { signal: AbortSignal.timeout(120_000), headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Não foi possível falar com o Google PageSpeed (sem resposta ou tempo esgotado).");
  }
  if (res.status === 429) {
    throw new Error(
      temChave()
        ? "O Google limitou as medições da sua chave por agora. Aguarde um pouco e tente de novo."
        : "O Google exige uma chave de API gratuita para medir. Veja o passo a passo nesta página.",
    );
  }
  let corpo: unknown = null;
  try {
    corpo = await res.json();
  } catch {
    /* corpo inválido tratado abaixo */
  }
  if (!res.ok) {
    const msg = (corpo as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(`O Google recusou a medição${msg ? `: ${String(msg).slice(0, 200)}` : ` (erro ${res.status})`}.`);
  }
  return lerRespostaPSI(corpo);
}

const dataLocal = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

const limpo = (t: string, max: number) => t.replace(/[^\p{L}\p{N} _\-/.]/gu, "").trim().slice(0, max);

export function registrarMedicao(d: {
  projetoId: number;
  url: string;
  dispositivo: "mobile" | "desktop";
  pagina: string;
  rotulo: string;
  leituras: Leitura[];
}): number {
  const l = consolidar(d.leituras);
  const detalhes = JSON.stringify({
    versao: l.versao,
    urlFinal: l.urlFinal,
    desempenhoPorRepeticao: d.leituras.map((x) => x.notas.desempenho),
  });
  const r = conectar()
    .prepare(
      `INSERT INTO medicoes (projeto_id, ferramenta, url, dispositivo, pagina, rotulo, repeticoes, medido_em,
        nota_desempenho, nota_acessibilidade, nota_boas_praticas, nota_seo, lcp_s, fcp_s, tbt_ms, cls, speed_index_s, detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      d.projetoId, FERRAMENTA, d.url, d.dispositivo, d.pagina, d.rotulo, d.leituras.length, dataLocal(),
      l.notas.desempenho, l.notas.acessibilidade, l.notas.boasPraticas, l.notas.seo,
      l.metricas.lcp_s, l.metricas.fcp_s, l.metricas.tbt_ms, l.metricas.cls, l.metricas.speedIndex_s, detalhes,
    );
  registrar(`Medição ${FERRAMENTA} (${d.dispositivo}, "${d.rotulo}"): desempenho ${l.notas.desempenho}, SEO ${l.notas.seo}`, d.projetoId);
  return Number(r.lastInsertRowid);
}

export async function medir(d: {
  projetoId: number;
  url: string;
  dispositivo: string;
  pagina: string;
  rotulo: string;
  repeticoes: number;
}): Promise<number> {
  const url = validarUrlPublica(d.url);
  if (d.dispositivo !== "mobile" && d.dispositivo !== "desktop") throw new Error("Escolha celular ou desktop.");
  const rotulo = limpo(d.rotulo, 60);
  if (!rotulo) throw new Error("Dê um rótulo à medição, como Antes, Depois ou Final.");
  const repeticoes = Math.min(Math.max(Math.trunc(d.repeticoes) || 1, 1), 3);
  const pagina = limpo(d.pagina, 60) || paginaPadrao(url);

  const leituras: Leitura[] = [];
  for (let i = 0; i < repeticoes; i++) leituras.push(await chamarGoogle(url, d.dispositivo));
  return registrarMedicao({ projetoId: d.projetoId, url, dispositivo: d.dispositivo, pagina, rotulo, leituras });
}

export function listarMedicoes(projetoId: number): Medicao[] {
  return conectar().prepare("SELECT * FROM medicoes WHERE projeto_id = ? ORDER BY id DESC").all(projetoId) as Medicao[];
}

export function obterMedicao(id: number): Medicao | undefined {
  return conectar().prepare("SELECT * FROM medicoes WHERE id = ?").get(id) as Medicao | undefined;
}

export function resumoTexto(m: Medicao): string {
  return (
    `Medição ${m.ferramenta} (${m.dispositivo}) em ${m.medido_em}, página "${m.pagina}", rótulo "${m.rotulo}"` +
    `${m.repeticoes > 1 ? `, mediana de ${m.repeticoes} medições` : ""}: ` +
    `desempenho ${m.nota_desempenho}, acessibilidade ${m.nota_acessibilidade}, boas práticas ${m.nota_boas_praticas}, SEO ${m.nota_seo}; ` +
    `LCP ${m.lcp_s}s, FCP ${m.fcp_s}s, TBT ${m.tbt_ms}ms, CLS ${m.cls}, Speed Index ${m.speed_index_s}s.`
  );
}

// Leva uma medição para os campos de desempenho do rascunho do dossiê. Fica registrada a origem de cada campo.
// As medições são guardadas junto a um registro interno e oculto (não aparece em nenhuma tela).
// Assim a página PageSpeed funciona sem depender de projetos.
const NOME_INTERNO = "PageSpeed (interno)";
export function projetoPageSpeed(): { id: number; slug: string } {
  const c = conectar();
  const existente = c.prepare("SELECT id, slug FROM projetos WHERE nome = ?").get(NOME_INTERNO) as { id: number; slug: string } | undefined;
  if (existente) return existente;
  const slug = criarProjeto({ nome: NOME_INTERNO, tipo: "Outros", descricao: "Registro interno das medições do PageSpeed. Não aparece nas telas." });
  return c.prepare("SELECT id, slug FROM projetos WHERE slug = ?").get(slug) as { id: number; slug: string };
}
