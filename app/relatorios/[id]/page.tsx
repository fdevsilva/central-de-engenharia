import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Carregando, Duas, Explica } from "../../components/ui";
import AtualizarSozinho from "../../components/AtualizarSozinho";
import ProgressoEstudo from "../../components/ProgressoEstudo";
import CopiarTexto from "../../components/CopiarTexto";
import { obterPasta } from "../../../lib/estudo";
import { nomeCategoria } from "../../../lib/categorias";
import { ROTULO_NIVEL } from "../../../lib/solucoes";
import { obterRelatorio, coberturaPorCategoria, pendenciasOrdenadas, prioridade, textoParaIA, custoDaLeitura, nomeExibicao } from "../../../lib/relatorio";

type Params = Promise<{ id: string }>;

export default function Detalhe({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

const tomPrioridade = { Alta: "amarelo", "Média": "neutro", Baixa: "neutro" } as const;

async function Conteudo({ params }: { params: Params }) {
  const { id } = await params;
  await connection();
  const rel = Number.isInteger(Number(id)) ? obterRelatorio(Number(id)) : undefined;
  if (!rel) notFound();
  const pasta = obterPasta(rel.pasta_id);
  const nome = pasta ? nomeExibicao(pasta) : "repositório";
  const andando = rel.estado === "Em andamento";
  const leitura = custoDaLeitura(rel.pasta_id);
  const cobertura = coberturaPorCategoria(rel.resultado);
  const pend = pendenciasOrdenadas(rel.resultado);
  const todos = rel.resultado.flatMap((g) => g.achados);

  return (
    <Pagina>
      <AtualizarSozinho ativo={andando} />
      <PageHeader titulo={`Relatório de melhorias: ${nome}`} sub={`Nível ${ROTULO_NIVEL[rel.nivel]} · ${rel.categorias.length} categoria(s) · iniciado em ${rel.iniciado_em}`} />
      <Duas
        principal={
          <>
            {andando && (
              <Card titulo="Andamento">
                <ProgressoEstudo modo="trechos" inicio={rel.iniciado_em} passos={rel.grupos_feitos} maxPassos={Math.max(rel.grupos_total, 1)} etapa="" lendo={rel.etapa || "Preparando"} />
                <p className="text-xs leading-relaxed text-muted">Cada grupo de categorias leva alguns minutos. Esta página se atualiza sozinha e você pode sair e voltar depois.</p>
              </Card>
            )}
            {rel.estado === "Falhou" && (
              <Card titulo="Não foi possível gerar">
                <p role="alert" className="text-sm text-warn">{rel.erro || "Erro inesperado."}</p>
                {rel.custo_usd > 0 && <p className="mt-2 text-xs text-muted">Custo até a falha: US$ {rel.custo_usd.toFixed(2)}.</p>}
                {pasta && <Link href={`/relatorios/novo?pasta=${pasta.id}`} className="mt-3 inline-block text-xs text-accent">Tentar de novo</Link>}
              </Card>
            )}

            {rel.estado === "Concluído" && (
              <>
                <Card titulo="Cobertura por categoria">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th className="pb-2 pr-3 font-normal">Categoria</th>
                          <th className="pb-2 pr-3 text-right font-normal">Conferidos</th>
                          <th className="pb-2 pr-3 text-right font-normal">Atendidos</th>
                          <th className="pb-2 pr-3 text-right font-normal">Parciais</th>
                          <th className="pb-2 pr-3 text-right font-normal">Não encontrados</th>
                          <th className="pb-2 text-right font-normal">Cobertura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {cobertura.map((c) => (
                          <tr key={c.slug}>
                            <td className="py-2 pr-3">{c.nome}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{c.verificados}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{c.atendidos}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{c.parciais}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{c.naoEncontrados}</td>
                            <td className="py-2 text-right tabular-nums font-semibold">{c.percentual === null ? "n/d" : `${c.percentual}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted">Cada item atendido vale 1 e cada parcial vale meio ponto, sobre os itens conferidos. Itens que não se aplicam ou não foram verificados ficam de fora.</p>
                </Card>

                {cobertura.map((c) => {
                  const itens = todos.filter((a) => a.categoria === c.slug);
                  const pc = pend.filter((a) => a.categoria === c.slug);
                  const ok = itens.filter((a) => a.status === "Atendido");
                  const texto = textoParaIA(nome, c.nome, pc);
                  return (
                    <details key={c.slug} open={pc.length > 0 && pc.some((a) => prioridade(a) === "Alta")} className="rounded-xl border border-line bg-panel p-5">
                      <summary className="cursor-pointer text-sm font-semibold">
                        {c.nome}
                        <span className="ml-2 text-xs font-normal text-muted">{c.percentual === null ? "n/d" : `${c.percentual}%`} · {pc.length} a melhorar</span>
                      </summary>
                      <div className="mt-4">
                        {pc.length === 0 ? (
                          <p className="text-sm text-muted">Nada a melhorar nos itens conferidos.</p>
                        ) : (
                          <ul className="flex flex-col divide-y divide-line">
                            {pc.map((a) => (
                              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <Link href={`/biblioteca/solucoes/${a.id}`} className="min-w-0 text-sm font-medium leading-snug hover:text-accent">{a.titulo}</Link>
                                  <span className="flex shrink-0 items-center gap-2">
                                    <Badge tom={tomPrioridade[prioridade(a)]}>{prioridade(a)}</Badge>
                                    <Badge>{ROTULO_NIVEL[a.nivel]}</Badge>
                                    <Badge tom={a.status === "Parcial" ? "amarelo" : "neutro"}>{a.status}</Badge>
                                  </span>
                                </div>
                                {a.acao && <p className="mt-1.5 text-sm leading-relaxed"><span className="text-muted">O que fazer: </span>{a.acao}</p>}
                                {a.nota && <p className="mt-1 text-xs leading-relaxed text-muted">{a.nota}</p>}
                                {a.evidencias.length > 0 && <p className="mt-1 break-all text-[14px] text-muted">Arquivos: {a.evidencias.join(", ")}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {ok.length > 0 && (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-xs text-accent">Já atendido ({ok.length})</summary>
                            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">{ok.map((a) => <li key={a.id}>{a.titulo}</li>)}</ul>
                          </details>
                        )}
                        {texto && (
                          <div className="mt-4">
                            <CopiarTexto texto={texto} rotulo="Copiar texto desta categoria para a IA" />
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </>
            )}
          </>
        }
        lateral={
          <>
            <Card titulo="Custo real">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Leitura do repositório{leitura ? ` (estudo #${leitura.id})` : ""}</dt><dd>{leitura ? `US$ ${leitura.custo.toFixed(2)}` : "ainda não lido"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Este relatório</dt><dd>US$ {rel.custo_usd.toFixed(2)}</dd></div>
                <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold"><dt>Leitura + relatório</dt><dd>US$ {((leitura?.custo ?? 0) + rel.custo_usd).toFixed(2)}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted">Valores equivalentes em API. No plano Pro o que pesa é o limite de uso.</p>
            </Card>
            {rel.estado === "Concluído" && (
              <Card titulo="Arquivo">
                <a href={`/relatorios/${rel.id}/arquivo`} className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]">Baixar relatório (.md)</a>
                <p className="mt-3 text-xs leading-relaxed text-muted">Markdown abre em qualquer editor. O arquivo traz a cobertura, a ordem de correção, o detalhe por categoria e o texto para colar na sua IA.</p>
                <p className="mt-3 text-sm"><strong className="font-semibold">{pend.length}</strong> ponto(s) a melhorar, <strong className="font-semibold">{pend.filter((a) => prioridade(a) === "Alta").length}</strong> de prioridade alta.</p>
                {rel.erro && <p className="mt-3 text-xs leading-relaxed text-warn">Avisos: {rel.erro}</p>}
              </Card>
            )}
            {pasta && <Link href="/repositorios" className="text-xs text-accent">Voltar aos repositórios</Link>}
          </>
        }
      />
    </Pagina>
  );
}
