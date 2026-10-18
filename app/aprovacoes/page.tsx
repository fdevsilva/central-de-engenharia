import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Duas, Explica, Carregando } from "../components/ui";
import { listarAprovacoes, type Aprovacao } from "../../lib/db";
import { chavesDe } from "../../lib/solucoes";
import { obterEstudo, obterPasta } from "../../lib/estudo";
import { decidir, aprovarTodasDoEstudo } from "../actions";

const tipos = [
  { t: "Biblioteca", d: "Incorporar conhecimento de forma permanente, com origem e data registradas." },
  { t: "Escopo", d: "Ampliar uma tarefa além do pedido original, com explicação do motivo." },
  { t: "Publicação", d: "Enviar alterações ao GitHub. Produção e credenciais exigem autorização específica." },
];

type Busca = Promise<Record<string, string | undefined>>;

export default function Aprovacoes({ searchParams }: { searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

const LIMITE_INICIAL = 15;
const PASSO = 15;

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const q = await searchParams;
  await connection();
  const todas = listarAprovacoes();
  const pendentes = todas.filter((a) => a.estado === "Pendente");
  const decididas = todas.filter((a) => a.estado !== "Pendente");
  // Cada clique em "Ver mais" libera mais 15 itens decididas, e assim por diante até o fim.
  const limite = Math.min(Math.max(Math.trunc(Number(q.decididas)) || LIMITE_INICIAL, LIMITE_INICIAL), 100000);
  const chaves = chavesDe(pendentes.map((a) => a.solucao_id).filter((x): x is number => !!x));

  // Propostas que vieram de um estudo de projeto ficam agrupadas: a revisão detalhada é na página do estudo.
  const porEstudo = new Map<number, Aprovacao[]>();
  const avulsas: Aprovacao[] = [];
  for (const a of pendentes) {
    const m = /^estudo:(\d+):/.exec((a.solucao_id && chaves.get(a.solucao_id)) || "");
    if (m) porEstudo.set(Number(m[1]), [...(porEstudo.get(Number(m[1])) ?? []), a]);
    else avulsas.push(a);
  }

  return (
    <Pagina>
      <PageHeader titulo="Aprovações" sub={pendentes.length === 0 ? "Novos achados das leituras entram direto na Biblioteca. Só ficam aqui os itens que conflitam com o que já existe." : `${pendentes.length} retido(s) para sua decisão. Novos achados sem conflito entram direto na Biblioteca.`} />
      <Duas
        principal={
          <>
            {pendentes.length === 0 && (
              <Card>
                <p className="py-4 text-center text-sm text-muted">Nenhum conflito retido. Tudo o que foi lido já está na Biblioteca.</p>
              </Card>
            )}

            {[...porEstudo.entries()].map(([id, itens]) => {
              const estudo = obterEstudo(id);
              const pasta = estudo ? obterPasta(estudo.pasta_id) : undefined;
              return (
                <Card key={id} titulo={`Estudo #${id}${pasta ? `: ${pasta.nome}` : ""}`}>
                  <p className="mb-4 text-sm leading-relaxed text-muted">
                    {itens.length} prática(s) retida(s) por conflito com um item que já existe na Biblioteca. Cada uma traz o motivo do conflito e permite definir o nível antes de decidir.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/estudos/${id}`} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]">Revisar os {itens.length} conflitos</Link>
                    <form action={aprovarTodasDoEstudo}>
                      <input type="hidden" name="estudo" value={id} />
                      <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink">Aprovar todos sem revisar</button>
                    </form>
                  </div>
                </Card>
              );
            })}

            {avulsas.length > 0 && (
              <Card titulo={`Outras aprovações (${avulsas.length})`}>
                <ul className="flex flex-col divide-y divide-line">
                  {avulsas.map((a) => (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tom="amarelo">{a.tipo}</Badge>
                        {a.solucao_id ? (
                          <Link href={`/biblioteca/solucoes/${a.solucao_id}`} className="min-w-0 text-sm hover:text-accent">{a.titulo}</Link>
                        ) : (
                          <span className="min-w-0 text-sm">{a.titulo}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted">Origem: {a.origem}</p>
                      <form action={decidir} className="mt-2 flex gap-2">
                        <input type="hidden" name="aprovacao" value={a.id} />
                        <button name="decisao" value="Aprovada" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-[#04211c]">Aprovar</button>
                        <button name="decisao" value="Rejeitada" className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">Rejeitar</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {decididas.length > 0 && (
              <details open={limite > LIMITE_INICIAL} className="rounded-xl border border-line bg-panel p-5">
                <summary className="cursor-pointer text-sm font-semibold">Decididas ({decididas.length})</summary>
                <ul className="mt-4 flex flex-col divide-y divide-line">
                  {decididas.slice(0, limite).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{a.titulo}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        {a.decidido_em?.slice(0, 10)}
                        <Badge tom={a.estado === "Aprovada" ? "verde" : "neutro"}>{a.estado}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="text-xs text-muted">Mostrando {Math.min(limite, decididas.length)} de {decididas.length}.</p>
                  {decididas.length > limite ? (
                    <Link href={`/aprovacoes?decididas=${limite + PASSO}`} scroll={false} className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent">
                      Ver mais
                    </Link>
                  ) : (
                    limite > LIMITE_INICIAL && <span className="text-xs text-muted">Fim da lista.</span>
                  )}
                </div>
              </details>
            )}
          </>
        }
        lateral={<Explica titulo="O que exige aprovação" itens={tipos} />}
      />
    </Pagina>
  );
}
