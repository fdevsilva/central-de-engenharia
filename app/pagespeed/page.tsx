import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Carregando, Duas, Explica } from "../components/ui";
import FormMedir from "../components/FormMedir";
import { listarMedicoes, temChave, projetoPageSpeed, type Medicao } from "../../lib/medicoes";

type Busca = Promise<Record<string, string | undefined>>;

export default function PageSpeed({ searchParams }: { searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

const ajuda = [
  { t: "Antes e depois", d: "Meça antes de mexer e de novo depois. A comparação entre as duas é a evidência mais forte de que a mudança funcionou." },
  { t: "Várias vezes", d: "Uma medição isolada ruim pode ser só a rede. Medir 3 vezes e usar a mediana dá um número confiável." },
  { t: "Ferramenta oficial", d: "Os números vêm do PageSpeed Insights do Google, a referência para Core Web Vitals no celular." },
  { t: "Dados de laboratório", d: "É uma simulação. Serve para guiar a engenharia, mas não substitui o monitoramento com usuários reais." },
];

const nota = (n: number) => (n >= 90 ? "text-accent" : n >= 50 ? "text-warn" : "text-ink");

function Delta({ atual, anterior, menorMelhor = false, casas = 0 }: { atual: number; anterior?: number; menorMelhor?: boolean; casas?: number }) {
  if (anterior === undefined) return null;
  const d = Math.round((atual - anterior) * 10 ** casas) / 10 ** casas;
  if (d === 0) return <span className="ml-1 text-[14px] text-muted">=</span>;
  const melhorou = menorMelhor ? d < 0 : d > 0;
  return <span className={`ml-1 text-[14px] ${melhorou ? "text-accent" : "text-warn"}`}>{d > 0 ? "+" : ""}{d}</span>;
}

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const q = await searchParams;
  await connection();
  const interno = projetoPageSpeed();
  const medicoes = listarMedicoes(interno.id);
  const urlInicial = medicoes[0]?.url ?? "";
  // Comparação com a medição anterior da mesma página e dispositivo.
  const anteriorDe = (m: Medicao): Medicao | undefined => medicoes.find((x) => x.id < m.id && x.url === m.url && x.dispositivo === m.dispositivo && x.pagina === m.pagina);

  return (
    <Pagina>
      <PageHeader titulo="PageSpeed" sub="Meça qualquer site público: desempenho, acessibilidade, boas práticas e SEO, com data e rótulo." />
      {q.erro && (
        <div role="alert" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">{q.erro}</div>
      )}
      {!temChave() && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] p-5">
          <h2 className="mb-2 text-sm font-semibold">Falta a chave gratuita do Google</h2>
          <p className="text-xs leading-relaxed text-muted">
            Crie uma chave de API do PageSpeed Insights no Google Cloud e coloque no arquivo <code className="rounded bg-panel2 px-1">.env.local</code> da pasta <code className="rounded bg-panel2 px-1">app</code>, na linha <code className="rounded bg-panel2 px-1">PAGESPEED_API_KEY=sua-chave</code>. Depois reinicie a Central.
          </p>
        </div>
      )}
      <Duas
        principal={
          <>
            <Card titulo="Nova medição">
              <FormMedir slug={interno.slug} urlInicial={urlInicial} />
            </Card>
            <Card titulo={`Histórico (${medicoes.length})`}>
              {medicoes.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Nenhuma medição ainda.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {medicoes.map((m) => {
                    const a = anteriorDe(m);
                    return (
                      <li key={m.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tom="verde">{m.rotulo}</Badge>
                          <span className="text-xs text-muted">
                            {m.medido_em} · {m.dispositivo} · página {m.pagina}{m.repeticoes > 1 ? ` · mediana de ${m.repeticoes}` : ""}
                          </span>
                        </div>
                        <p className="mb-2 break-all text-[14px] text-muted">{m.url}</p>
                        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <div><dt className="text-[14px] text-muted">Desempenho</dt><dd className={`text-lg font-semibold ${nota(m.nota_desempenho)}`}>{m.nota_desempenho}<Delta atual={m.nota_desempenho} anterior={a?.nota_desempenho} /></dd></div>
                          <div><dt className="text-[14px] text-muted">Acessibilidade</dt><dd className={`text-lg font-semibold ${nota(m.nota_acessibilidade)}`}>{m.nota_acessibilidade}<Delta atual={m.nota_acessibilidade} anterior={a?.nota_acessibilidade} /></dd></div>
                          <div><dt className="text-[14px] text-muted">Boas práticas</dt><dd className={`text-lg font-semibold ${nota(m.nota_boas_praticas)}`}>{m.nota_boas_praticas}<Delta atual={m.nota_boas_praticas} anterior={a?.nota_boas_praticas} /></dd></div>
                          <div><dt className="text-[14px] text-muted">SEO</dt><dd className={`text-lg font-semibold ${nota(m.nota_seo)}`}>{m.nota_seo}<Delta atual={m.nota_seo} anterior={a?.nota_seo} /></dd></div>
                        </dl>
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                          <div><dt className="text-muted">LCP</dt><dd>{m.lcp_s}s<Delta atual={m.lcp_s} anterior={a?.lcp_s} menorMelhor casas={1} /></dd></div>
                          <div><dt className="text-muted">FCP</dt><dd>{m.fcp_s}s<Delta atual={m.fcp_s} anterior={a?.fcp_s} menorMelhor casas={1} /></dd></div>
                          <div><dt className="text-muted">TBT</dt><dd>{m.tbt_ms}ms<Delta atual={m.tbt_ms} anterior={a?.tbt_ms} menorMelhor /></dd></div>
                          <div><dt className="text-muted">CLS</dt><dd>{m.cls}<Delta atual={m.cls} anterior={a?.cls} menorMelhor casas={3} /></dd></div>
                          <div><dt className="text-muted">Speed Index</dt><dd>{m.speed_index_s}s<Delta atual={m.speed_index_s} anterior={a?.speed_index_s} menorMelhor casas={1} /></dd></div>
                        </dl>
                        {a && <p className="mt-2 text-[14px] text-muted">Variação em relação à medição anterior ({a.rotulo}, {a.medido_em}).</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        }
        lateral={<Explica titulo="Como medir bem" itens={ajuda} />}
      />
    </Pagina>
  );
}
