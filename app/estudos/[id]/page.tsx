import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Carregando, Duas, Explica } from "../../components/ui";
import AtualizarSozinho from "../../components/AtualizarSozinho";
import ProgressoEstudo from "../../components/ProgressoEstudo";
import { obterEstudo, obterPasta, propostasDoEstudo, PASSOS_PREVISTOS, type Ignorado } from "../../../lib/estudo";
import { ROTULO_NIVEL, NIVEIS } from "../../../lib/solucoes";
import { decidirNoEstudo, aprovarTodasDoEstudo, iniciarEnriquecimentoAcao } from "../../actions";
import { lerStatus, pendentesDeFicha } from "../../../lib/enriquecimento";

export default function PaginaEstudo({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

const ajuda = [
  { t: "Entra direto, salvo conflito", d: "O que foi extraído entra na Biblioteca já aprovado, com o nível decidido pela IA. Fica retido para você só o que contradiz um item existente. Práticas que repetem um item existente viram evidência nele, sem duplicar." },
  { t: "Origem sempre visível", d: "Cada item mostra se foi confirmada no código ou só declarada na documentação." },
  { t: "O que a Central conferiu", d: "Achados que citam arquivos inexistentes ou parecem conter segredo foram descartados antes de chegar aqui." },
  { t: "O que a Central NÃO fez", d: "Não executou nem testou o código do projeto. Presença no código não prova que a solução está correta, por isso nenhum item vem como validado." },
];

async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const estudo = Number.isInteger(Number(id)) ? obterEstudo(Number(id)) : undefined;
  if (!estudo) notFound();
  const pasta = obterPasta(estudo.pasta_id);
  const propostas = propostasDoEstudo(estudo.id);
  const ignorados = JSON.parse(estudo.ignorados) as Ignorado[];
  const descartes = JSON.parse(estudo.descartes) as string[];
  const pendentes = propostas.filter((p) => p.decisao === "Pendente").length;
  const andando = estudo.estado === "Em andamento";
  const ficha = lerStatus();
  const fichaAndando = ficha?.estado === "Em andamento";
  const semFicha = pendentesDeFicha().length;

  return (
    <Pagina>
      <AtualizarSozinho ativo={andando || fichaAndando} />
      <PageHeader titulo={`Estudo #${estudo.id}: ${pasta?.nome ?? "pasta"}`} sub={`Leitura somente. Iniciado em ${estudo.iniciado_em}.`} />
      <Duas
        principal={
          <>
            <Card titulo="Andamento">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tom={estudo.estado === "Concluído" ? "verde" : estudo.estado === "Falhou" ? "amarelo" : "amarelo"}>{estudo.estado}</Badge>
                <span className="text-sm text-muted">{estudo.etapa}</span>
              </div>
              {andando && (
                <>
                  <ProgressoEstudo inicio={estudo.iniciado_em} passos={estudo.passos} maxPassos={PASSOS_PREVISTOS} etapa={estudo.etapa} lendo={estudo.lendo} />
                  <p className="text-xs leading-relaxed text-muted">Esta página se atualiza sozinha. Você pode sair e voltar depois.</p>
                </>
              )}
              {estudo.erro && <p role="alert" className="text-sm text-warn">{estudo.erro}</p>}
              {estudo.resumo && (
                <>
                  <h3 className="mb-1 mt-3 text-xs text-muted">O que a IA entendeu do projeto</h3>
                  <p className="text-sm leading-relaxed">{estudo.resumo}</p>
                </>
              )}
            </Card>

            {estudo.estado === "Concluído" && (semFicha > 0 || fichaAndando) && (
              <Card titulo="Ficha completa e nível">
                {fichaAndando ? (
                  <p className="text-sm leading-relaxed">A IA está completando as fichas: {ficha!.feitos} de {ficha!.total}. Esta página se atualiza sozinha.</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm leading-relaxed text-muted">
                      {semFicha > 0
                        ? `${semFicha} item(ns) da Biblioteca ainda sem a explicação completa. A IA escreve, para cada um, o resumo, o que tem dentro, por que existe, a técnica e os conceitos, e decide o nível das propostas com a justificativa. Níveis que vieram dos seus documentos não são alterados.`
                        : "Todos os itens já têm a explicação completa."}
                    </p>
                    {semFicha > 0 && (
                      <form action={iniciarEnriquecimentoAcao}>
                        <input type="hidden" name="volta" value={`/estudos/${estudo.id}`} />
                        <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]">Completar {semFicha} ficha(s) com a IA</button>
                      </form>
                    )}
                    {ficha && ficha.estado !== "Em andamento" && (
                      <p className="mt-3 text-xs text-muted">
                        Último preenchimento de fichas da Biblioteca inteira (não é custo desta leitura): {ficha.feitos} de {ficha.total} ficha(s), {ficha.niveis} nível(is) definido(s) pela IA, US$ {ficha.custo.toFixed(2)}.
                        {ficha.erro && <span className="block text-warn">{ficha.erro}</span>}
                      </p>
                    )}
                  </>
                )}
              </Card>
            )}

            {estudo.estado === "Concluído" && (
              <Card
                titulo={`Itens extraídos (${propostas.length})`}
                extra={
                  pendentes > 0 ? (
                    <form action={aprovarTodasDoEstudo}>
                      <input type="hidden" name="estudo" value={estudo.id} />
                      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-[#04211c]">Aprovar os {pendentes} retidos</button>
                    </form>
                  ) : undefined
                }
              >
                {propostas.length === 0 ? (
                  <p className="text-sm text-muted">A IA não encontrou práticas que pudessem ser comprovadas nos arquivos.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {propostas.map((p) => (
                      <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <Link href={`/biblioteca/solucoes/${p.id}`} className="min-w-0 text-sm font-medium leading-snug hover:text-accent">{p.titulo}</Link>
                          <span className="flex shrink-0 items-center gap-2">
                            {p.nivel && <Badge tom="verde">Nível {ROTULO_NIVEL[p.nivel]}{p.nivel_por === "IA" ? " (IA)" : ""}</Badge>}
                            <Badge tom={p.decisao === "Aprovada" ? "verde" : p.decisao === "Rejeitada" ? "neutro" : "amarelo"}>
                              {p.decisao === "Pendente" ? "Retido por conflito" : p.decisao === "Aprovada" ? "Na Biblioteca" : p.decisao}
                            </Badge>
                          </span>
                        </div>
                        {p.resumo && <p className="mt-2 text-sm leading-relaxed">{p.resumo}</p>}
                        {p.pilar && <p className="mt-1 text-xs text-muted">Pilar: {p.pilar}</p>}
                        <p className="mt-1 text-[14px] text-muted">{p.tipo} · {p.origem}</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-accent">Ver nível, explicação e texto da fonte</summary>
                          {p.nivel && p.justificativa_nivel && (
                            <p className="mt-2 text-sm leading-relaxed"><strong className="font-semibold">Por que {ROTULO_NIVEL[p.nivel]}:</strong> {p.justificativa_nivel}</p>
                          )}
                          {p.explicacao && (
                            <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed">
                              {p.explicacao.split("\n").map((l) => <li key={l}>{l.replace(" :: ", ": ")}</li>)}
                            </ul>
                          )}
                          <p className="mt-3 text-xs text-muted">Texto da fonte:</p>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed">{p.descricao}</p>
                          <p className="mt-2 text-xs leading-relaxed text-muted">{p.limitacoes}</p>
                        </details>
                        {p.decisao === "Pendente" && (
                          <form action={decidirNoEstudo} className="mt-3 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="estudo" value={estudo.id} />
                            <input type="hidden" name="aprovacao" value={p.aprovacao_id} />
                            <input type="hidden" name="solucao" value={p.id} />
                            <div>
                              <label htmlFor={`nv-${p.id}`} className="mb-1 block text-[14px] text-muted">Nível (opcional)</label>
                              <select id={`nv-${p.id}`} name="nivel" defaultValue={p.nivel ?? ""} className="h-8 rounded-md border border-line bg-panel2 px-2 text-xs">
                                <option value="">Sem nível</option>
                                {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
                              </select>
                            </div>
                            <button name="decisao" value="Aprovada" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink hover:border-accent">Aprovar</button>
                            <button name="decisao" value="Rejeitada" className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">Rejeitar</button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </>
        }
        lateral={
          <>
            <Card titulo="Resumo da leitura">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Arquivos lidos</dt><dd>{estudo.copiados}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Modelo</dt><dd>{estudo.modelo}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Custo desta leitura</dt><dd>{estudo.custo_usd !== null ? `US$ ${estudo.custo_usd.toFixed(2)}` : "n/d"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Itens</dt><dd>{estudo.achados}</dd></div>
              </dl>
              {estudo.estado === "Concluído" && (
                <Link href={`/relatorios/novo?pasta=${estudo.pasta_id}`} className="mt-4 inline-block rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-[var(--accent-soft)]">
                  Gerar relatório de melhorias
                </Link>
              )}
            </Card>
            {ignorados.length > 0 && (
              <Card titulo="O que NÃO foi lido">
                <ul className="flex flex-col gap-2 text-xs leading-relaxed">
                  {ignorados.map((g) => (
                    <li key={g.motivo}>
                      <span className="text-ink">{g.motivo}</span> <span className="text-muted">({g.quantidade})</span>
                      {/sens|segredo/i.test(g.motivo) && <span className="block text-muted">{g.exemplos.join(", ")}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {descartes.length > 0 && (
              <Card titulo={`Descartados pela Central (${descartes.length})`}>
                <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-warn">
                  {descartes.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </Card>
            )}
            <Explica titulo="Como ler esta página" itens={ajuda} />
          </>
        }
      />
    </Pagina>
  );
}
