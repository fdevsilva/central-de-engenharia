import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Carregando, Duas, Explica, tomValidacao } from "../../../components/ui";
import { listarSolucoes, NIVEIS, ROTULO_NIVEL, SIGNIFICADO_NIVEL, type Nivel, type Solucao } from "../../../../lib/solucoes";
import { categoriaPorSlug } from "../../../../lib/categorias";

type Busca = Promise<Record<string, string | undefined>>;

export default function Categoria({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const FILTROS: { chave: string; nivel: Nivel | null; rotulo: string }[] = [
  { chave: "junior", nivel: "BASE", rotulo: "Júnior" },
  { chave: "senior", nivel: "SÊNIOR", rotulo: "Sênior" },
  { chave: "staff", nivel: "STAFF", rotulo: "Staff" },
  { chave: "todos", nivel: null, rotulo: "Todos os níveis" },
];

function Linha({ s }: { s: Solucao }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Link href={`/biblioteca/solucoes/${s.id}`} className="block hover:text-accent">
        <div className="flex items-start justify-between gap-4">
          <span className="min-w-0 text-sm leading-snug">{s.titulo}</span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge tom={tomValidacao(s.estado)}>{s.estado}</Badge>
          </span>
        </div>
        <p className="mt-1 text-[14px] text-muted">{s.tipo} · {s.origem}</p>
      </Link>
    </li>
  );
}

async function Conteudo({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Busca }) {
  const { slug } = await params;
  const q = await searchParams;
  const filtro = FILTROS.find((f) => f.chave === (q.nivel === "basico" ? "junior" : q.nivel)) ?? FILTROS[3];
  const categoria = categoriaPorSlug(slug);
  if (!categoria) notFound();
  await connection();
  const solucoes = listarSolucoes({ categoria: slug }).filter((s) => s.situacao === "Incorporada");
  // Contagem do que a lista realmente mostra: só o que já está incorporado.
  const nv = { BASE: 0, "SÊNIOR": 0, STAFF: 0, sem: 0 } as Record<Nivel | "sem", number>;
  for (const s of solucoes) nv[s.nivel ?? "sem"]++;
  const grupos: { chave: Nivel | "sem"; titulo: string; texto: string; itens: Solucao[] }[] = [
    ...NIVEIS.map((n) => ({ chave: n, titulo: ROTULO_NIVEL[n], texto: SIGNIFICADO_NIVEL[n], itens: solucoes.filter((s) => s.nivel === n) })),
    { chave: "sem" as const, titulo: "Sem nível", texto: "Procedimentos, padrões e conhecimentos que não são itens de checklist por nível.", itens: solucoes.filter((s) => !s.nivel) },
  ].filter((g) => g.itens.length > 0 && (filtro.nivel === null || g.chave === filtro.nivel));
  const comNiveis = nv.BASE + nv["SÊNIOR"] + nv.STAFF > 0;
  const mostrados = grupos.reduce((n, g) => n + g.itens.length, 0);

  return (
    <Pagina>
      <PageHeader
        titulo={categoria.nome}
        sub={`${categoria.resumo} ${solucoes.length > 0 ? (filtro.nivel ? `Mostrando ${mostrados} de ${solucoes.length} itens (${filtro.rotulo}).` : `${solucoes.length} ${solucoes.length === 1 ? "item" : "itens"} na Biblioteca.`) : ""}`}
        acao={{ href: "/biblioteca/solucoes/nova", label: "Nova solução" }}
      />
      <Duas
        principal={
          solucoes.length === 0 ? (
            <Card titulo="Soluções">
              <p className="py-6 text-center text-sm leading-relaxed text-muted">
                Nenhuma solução cadastrada nesta categoria. O conteúdo é construído aos poucos, com origem identificada e validação.
              </p>
            </Card>
          ) : (
            <>
              {grupos.map((g) => (
                <Card key={g.chave} titulo={`${g.titulo} (${g.itens.length})`}>
                  <p className="mb-4 text-xs leading-relaxed text-muted">{g.texto}</p>
                  <ul className="flex flex-col divide-y divide-line">
                    {g.itens.map((s) => <Linha key={s.id} s={s} />)}
                  </ul>
                </Card>
              ))}
            </>
          )
        }
        lateral={
          <>
            <Explica titulo="O que esta categoria cobre" itens={[{ t: categoria.nome, d: categoria.escopo }]} />
            {comNiveis && (
              <Card titulo="Escolha o nível que quer ver">
                <p className="mb-4 text-xs leading-relaxed text-muted">
                  Cada item da lista tem um nível de rigor. Escolha um para ver só os itens dele, ou veja todos.
                </p>
                <ul className="flex flex-col gap-2">
                  {FILTROS.map((f) => {
                    const ativo = f.chave === filtro.chave;
                    const total = f.nivel ? nv[f.nivel] : nv.BASE + nv["SÊNIOR"] + nv.STAFF + nv.sem;
                    return (
                      <li key={f.chave}>
                        <Link
                          href={f.chave === "todos" ? `/biblioteca/categoria/${slug}` : `/biblioteca/categoria/${slug}?nivel=${f.chave}`}
                          aria-current={ativo ? "true" : undefined}
                          className={`block rounded-lg border px-4 py-3 ${ativo ? "border-accent bg-[var(--accent-soft)]" : "border-line hover:border-accent"}`}
                        >
                          <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                            <span>{f.rotulo}</span>
                            <span className="text-xs font-normal text-muted">{total} {total === 1 ? "item" : "itens"}</span>
                          </span>
                          <span className="mt-1 block text-[14px] leading-relaxed text-muted">
                            {f.nivel ? SIGNIFICADO_NIVEL[f.nivel] : "Mostra a lista completa, do Júnior ao Staff, sem filtro."}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Aqui o filtro mostra só o nível escolhido. Ao criar um projeto, o nível é cumulativo: escolher Sênior exige também os itens Júnior.
                </p>
              </Card>
            )}
            <Link href="/biblioteca" className="text-xs text-accent">Voltar às categorias</Link>
          </>
        }
      />
    </Pagina>
  );
}
