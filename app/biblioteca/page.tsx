import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Lista, Linha, Pagina, Carregando, tomValidacao } from "../components/ui";
import { listarMateriais } from "../../lib/db";
import { contagemPorCategoria, contagemNiveis, totais, ROTULO_NIVEL } from "../../lib/solucoes";
import { CATEGORIAS, nomeCategoria } from "../../lib/categorias";
import { estadoBibliotecaBase } from "../../lib/biblioteca-base";
import { carregarBibliotecaBaseAcao } from "../actions";

export default function Biblioteca({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  await connection();
  const materiais = listarMateriais();
  const contagem = contagemPorCategoria();
  const t = totais();
  const base = estadoBibliotecaBase();
  const [novas, ja, invalidos] = (q.base ?? "").split(".").map(Number);

  return (
    <Pagina>
      <PageHeader
        titulo="Biblioteca de Engenharia"
        sub={`13 categorias. ${t.incorporadas} soluções na Biblioteca, sempre atualizada com o que as leituras assimilam.`}
        acao={{ href: "/biblioteca/solucoes/nova", label: "Nova solução" }}
      />
      {q.recebidos !== undefined && (
        <div role="status" className="mb-4 rounded-lg border border-line bg-panel px-4 py-3 text-sm">
          Recebidos: {q.recebidos}. Já existentes (ignorados): {q.duplicados}. Conflitos de versão: {q.conflitos}. Recusados: {q.recusados}.
        </div>
      )}
      {q.erro && (
        <div role="alert" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">{q.erro}</div>
      )}
      {q.base !== undefined && (
        <div role="status" className="mb-4 rounded-lg border border-line bg-panel px-4 py-3 text-sm">
          Biblioteca base: {novas} item(ns) novo(s), {ja} já existia(m).
          {invalidos > 0 && <span className="text-warn"> {invalidos} item(ns) do pacote foram ignorados por estarem inválidos.</span>}
        </div>
      )}

      {base.disponivel && base.carregados < base.noPacote && (
        <section aria-labelledby="base" className="mb-6">
          <Card titulo="Biblioteca base">
            <p id="base" className="mb-3 text-sm leading-relaxed text-muted">
              {base.carregados === 0
                ? `A Central acompanha uma Biblioteca com ${base.noPacote} itens de engenharia, em 13 categorias e 3 níveis (Júnior, Sênior e Staff), cada um com ficha completa. Carregue para começar.`
                : `Faltam ${base.noPacote - base.carregados} itens da Biblioteca base. Carregar de novo não duplica nada: só entra o que ainda não existe.`}
            </p>
            <form action={carregarBibliotecaBaseAcao}>
              <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]">
                Carregar a Biblioteca base ({base.noPacote - base.carregados} itens)
              </button>
            </form>
          </Card>
        </section>
      )}

      <section aria-labelledby="cats" className="mb-8">
        <h2 id="cats" className="mb-3 text-sm font-semibold">Categorias</h2>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {CATEGORIAS.map((c, i) => {
            const n = contagem[c.slug];
            const nv = contagemNiveis(c.slug);
            const temNivel = nv.BASE + nv["SÊNIOR"] + nv.STAFF > 0;
            return (
              <Link
                key={c.slug}
                href={`/biblioteca/categoria/${c.slug}`}
                className="flex flex-col rounded-xl border border-line bg-panel p-4 hover:border-accent"
              >
                <h3 className="text-sm font-medium">
                  <span className="mr-2 text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {c.nome}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.resumo}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {n.incorporadas > 0 ? (
                    <Badge tom="verde">{n.incorporadas} {n.incorporadas === 1 ? "item" : "itens"}</Badge>
                  ) : (
                    <span className="text-muted">Nenhuma solução ainda</span>
                  )}
                </div>
                {temNivel && (
                  <p className="mt-2 text-[14px] text-muted">
                    {(["BASE", "SÊNIOR", "STAFF"] as const).filter((x) => nv[x] > 0).map((x) => `${ROTULO_NIVEL[x]} ${nv[x]}`).join(" · ")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="mats">
        <Card
          titulo="Materiais recebidos (origem)"
          extra={<Link href="/uploads" className="text-xs text-accent">Adicionar material</Link>}
        >
          <p id="mats" className="mb-3 text-xs leading-relaxed text-muted">
            Arquivos originais preservados. Soluções são criadas a partir deles e citam a origem.
          </p>
          {materiais.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Nenhum material ainda.</p>
          ) : (
            <Lista>
              {materiais.map((m) => (
                <Linha
                  key={m.id}
                  href={`/biblioteca/${m.id}`}
                  titulo={m.nome}
                  texto={`Versão ${m.versao} · sugestão de categoria: ${nomeCategoria(m.categoria ?? "")} · recebido em ${m.recebido_em}`}
                  direita={<Badge tom={tomValidacao(m.estado)}>{m.estado}</Badge>}
                />
              ))}
            </Lista>
          )}
        </Card>
      </section>
    </Pagina>
  );
}
