import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Carregando, Duas, tomValidacao } from "../../../components/ui";
import { obterSolucao, listarEvidencias, ROTULO_NIVEL, NIVEIS } from "../../../../lib/solucoes";
import { obterMaterial } from "../../../../lib/db";
import { nomeCategoria, ESTADOS_VALIDACAO } from "../../../../lib/categorias";
import { lerConteudo, temFichaNova } from "../../../../lib/ficha-texto";
import { salvarEvidencia, mudarEstado, acaoNivelSolucao } from "../../../actions";

type Params = Promise<{ id: string }>;
type Busca = Promise<Record<string, string | undefined>>;

export default function Detalhe({ params, searchParams }: { params: Params; searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const semPonto = (t: string) => t.replace(/[.\s]+$/, "").trim();

async function Conteudo({ params, searchParams }: { params: Params; searchParams: Busca }) {
  const { id } = await params;
  const q = await searchParams;
  await connection();
  const solucao = Number.isInteger(Number(id)) ? obterSolucao(Number(id)) : undefined;
  if (!solucao) notFound();
  const evidencias = listarEvidencias(solucao.id);
  const material = solucao.material_id ? obterMaterial(solucao.material_id) : undefined;
  const ficha = temFichaNova(solucao.explicacao) ? lerConteudo(solucao.explicacao) : null;
  const principal = solucao.categorias.length > 0 ? nomeCategoria(solucao.categorias[0]) : "";
  const igualAoTitulo = semPonto(solucao.descricao || "") === semPonto(solucao.titulo);
  const nivelTxt = solucao.nivel ? ROTULO_NIVEL[solucao.nivel] : "";

  return (
    <Pagina>
      <PageHeader titulo={solucao.titulo} sub={[solucao.tipo, principal, nivelTxt && `Nível ${nivelTxt}`].filter(Boolean).join(" · ")} />
      {q.erro && (
        <div role="alert" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">
          {q.erro}
        </div>
      )}
      <Duas
        principal={
          <>
            {ficha ? (
              <>
                <section className="rounded-xl border border-line border-l-4 border-l-accent bg-[linear-gradient(135deg,rgba(45,212,191,0.10),rgba(255,255,255,0.02))] px-6 py-5">
                  <h2 className="text-[14px] font-semibold">Em uma frase</h2>
                  <p className="mt-1 text-[21px] leading-snug">{solucao.resumo}</p>
                </section>
                <section className="border-b border-line pb-6">
                  <h2 className="text-[21px] font-semibold">Por que existe</h2>
                  <p className="mt-2 text-sm leading-relaxed">{ficha.porque}</p>
                </section>
                <section className="border-b border-line pb-6">
                  <h2 className="text-[21px] font-semibold">Técnica</h2>
                  <p className="mt-2 text-sm leading-relaxed">{ficha.tecnica}</p>
                </section>
                <section className="border-b border-line pb-6">
                  <h2 className="text-lg font-semibold">O que você precisa entender</h2>
                  <ol className="mt-3 flex flex-col gap-4">
                    {ficha.conceitos.map((c, i) => (
                      <li key={c.nome} className="text-sm leading-relaxed">
                        <p className="font-semibold">{i + 1}. {c.nome}</p>
                        <p className="mt-0.5"><span className="text-muted">O que significa: </span>{c.significa}</p>
                      </li>
                    ))}
                  </ol>
                </section>
                {solucao.nivel && (
                  <section className="border-b border-line pb-6">
                    <h2 className="text-lg font-semibold">Por que {nivelTxt}</h2>
                    <p className="mt-2 text-sm leading-relaxed">{solucao.justificativa_nivel || "Sem justificativa registrada."}</p>
                  </section>
                )}
                <p className="text-xs leading-relaxed text-muted">
                  Texto explicativo gerado pela IA com conhecimento geral de engenharia, para facilitar a leitura. Não faz parte da sua fonte e não foi validado: o estado do item continua sendo o que você definir.
                </p>
              </>
            ) : (
              <section className="border-b border-line pb-6">
                <h2 className="text-[21px] font-semibold">Descrição</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{solucao.descricao || "Sem descrição registrada."}</p>
                <p className="mt-3 text-xs text-muted">A explicação completa deste item ainda não foi gerada.</p>
              </section>
            )}
            <details className="border-b border-line pb-4">
              <summary className="cursor-pointer text-sm font-semibold">Evidências ({evidencias.length})</summary>
              <div className="mt-4">
                {evidencias.length === 0 ? (
                  <p className="mb-4 text-sm text-muted">Nenhuma evidência registrada. Sem evidência, a solução não pode ser validada.</p>
                ) : (
                  <ul className="mb-4 flex flex-col divide-y divide-line">
                    {evidencias.map((e) => (
                      <li key={e.id} className="py-3 first:pt-0">
                        <p className="text-sm leading-relaxed">{e.descricao}</p>
                        <p className="mt-1 text-xs text-muted">
                          {e.referencia ? `${e.referencia} · ` : ""}registrada em {e.criado_em}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={salvarEvidencia} className="flex flex-col gap-3 border-t border-line pt-4">
                  <input type="hidden" name="solucao" value={solucao.id} />
                  <label htmlFor="ev-desc" className="text-xs text-muted">Registrar evidência (teste, medição ou resultado verificado)</label>
                  <textarea id="ev-desc" name="descricao" rows={3} required maxLength={1500} className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm" />
                  <label htmlFor="ev-ref" className="text-xs text-muted">Referência (opcional): arquivo, link ou medição</label>
                  <input id="ev-ref" name="referencia" maxLength={300} className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm" />
                  <div>
                    <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink">
                      Registrar evidência
                    </button>
                  </div>
                </form>
              </div>
            </details>
            <details className="border-b border-line pb-4">
              <summary className="cursor-pointer text-sm font-semibold">Limitações conhecidas</summary>
              <div className="mt-4">
                {solucao.limitacoes ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{solucao.limitacoes}</p>
                ) : (
                  <p className="text-sm text-warn">Nenhuma limitação registrada. Isso não significa que não existam.</p>
                )}
              </div>
            </details>
            {ficha && !igualAoTitulo && solucao.descricao && (
              <details className="border-b border-line pb-4">
                <summary className="cursor-pointer text-sm font-semibold">Texto da fonte</summary>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{solucao.descricao}</p>
              </details>
            )}
          </>
        }
        lateral={
          <>
            <Card titulo="Confiabilidade">
              <dl className="mb-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Nível</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    {solucao.nivel ? <Badge tom="verde">{nivelTxt}</Badge> : <span className="text-muted">Sem nível</span>}
                    <span className="text-xs text-muted">
                      {solucao.nivel_por === "IA" ? "decidido pela IA" : solucao.nivel_por === "Usuário" ? "decidido por você" : solucao.nivel_por === "Documento" ? "veio do seu documento" : ""}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Categorias</dt>
                  <dd className="mt-1">
                    <ul className="flex flex-wrap gap-2">
                      {solucao.categorias.map((c) => (
                        <li key={c}>
                          <Link href={`/biblioteca/categoria/${c}`} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-accent">
                            {nomeCategoria(c)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                {solucao.pilar && (
                  <div>
                    <dt className="text-xs text-muted">Pilar</dt>
                    <dd className="mt-1 leading-relaxed">{solucao.pilar}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted">Situação</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tom={tomValidacao(solucao.estado)}>{solucao.estado}</Badge>
                    <Badge tom={solucao.situacao === "Incorporada" ? "verde" : solucao.situacao === "Proposta" ? "amarelo" : "neutro"}>
                      {solucao.situacao === "Proposta" ? "Em análise" : solucao.situacao}
                    </Badge>
                  </dd>
                </div>
              </dl>
              <form action={mudarEstado} className="flex flex-col gap-2 border-t border-line pt-4">
                <input type="hidden" name="solucao" value={solucao.id} />
                <label htmlFor="estado" className="text-xs text-muted">Alterar estado de validação</label>
                <select id="estado" name="estado" defaultValue={solucao.estado} className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm">
                  {ESTADOS_VALIDACAO.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
                <div>
                  <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink">
                    Salvar estado
                  </button>
                </div>
              </form>
              <form action={acaoNivelSolucao} className="mt-4 flex flex-col gap-2">
                <input type="hidden" name="solucao" value={solucao.id} />
                <label htmlFor="nivel" className="text-xs text-muted">Mudar o nível</label>
                <select id="nivel" name="nivel" defaultValue={solucao.nivel ?? ""} className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm">
                  <option value="">Sem nível</option>
                  {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
                </select>
                <p className="text-[14px] leading-relaxed text-muted">Com nível, esta solução pode ser exigida nos projetos que escolherem esse nível na área dela.</p>
                <div><button type="submit" className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink">Salvar nível</button></div>
              </form>
              {solucao.situacao === "Proposta" && (
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Aguardando sua decisão em <Link href="/aprovacoes" className="text-accent">Aprovações</Link>.
                </p>
              )}
            </Card>
            <Card titulo="Origem">
              <p className="text-sm leading-relaxed">{solucao.origem}</p>
              {material && (
                <Link href={`/biblioteca/${material.id}`} className="mt-2 inline-block text-xs text-accent">
                  Ver material original
                </Link>
              )}
            </Card>
          </>
        }
      />
    </Pagina>
  );
}
