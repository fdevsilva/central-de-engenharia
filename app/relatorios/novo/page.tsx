import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Card, Pagina, Carregando, Duas, Explica } from "../../components/ui";
import { obterPasta } from "../../../lib/estudo";
import { CATEGORIAS } from "../../../lib/categorias";
import { contagemParaEscolha, custoDaLeitura, nomeExibicao, GRUPOS } from "../../../lib/relatorio";
import { NIVEIS, ROTULO_NIVEL, SIGNIFICADO_NIVEL } from "../../../lib/solucoes";
import { iniciarRelatorioAcao } from "../../actions";

type Busca = Promise<Record<string, string | undefined>>;

export default function NovoRelatorio({ searchParams }: { searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

const ajuda = [
  { t: "Só quando você pedir", d: "A leitura de um repositório não gera relatório sozinha. Você pode ler só para enriquecer a Biblioteca." },
  { t: "Como funciona", d: "A IA confere, categoria por categoria, os itens da Biblioteca contra o código: atendido, parcial ou não encontrado, citando o arquivo." },
  { t: "O que sai", d: "Um relatório em Markdown (.md) com a cobertura por categoria, a ordem de correção e um texto pronto para colar na IA que você usa no desenvolvimento." },
  { t: "Quanto custa", d: "Em geral de US$ 1 a US$ 3 por repositório com as 13 categorias, valor equivalente em API. No plano Pro o que pesa é o limite de uso. Menos categorias custam menos. O custo real aparece no fim." },
  { t: "Só leitura", d: "A Central não altera nem executa nada do repositório. Repositórios de terceiros são baixados só para esta leitura e apagados em seguida." },
];

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const q = await searchParams;
  await connection();
  const pasta = Number.isInteger(Number(q.pasta)) ? obterPasta(Number(q.pasta)) : undefined;
  if (!pasta || !pasta.ativa) notFound();
  const contagem = contagemParaEscolha();
  const leitura = custoDaLeitura(pasta.id);
  const grupoDe = (slug: string) => GRUPOS.findIndex((g) => g.slugs.includes(slug)) + 1;

  return (
    <Pagina>
      <PageHeader titulo="Gerar relatório de melhorias" sub={`${nomeExibicao(pasta)}${pasta.origem_url ? " (repositório de terceiros)" : ""}. Leitura somente.`} />
      {q.erro && (
        <div role="alert" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">{q.erro}</div>
      )}
      <Duas
        principal={
          <Card>
            <form action={iniciarRelatorioAcao} className="flex flex-col gap-6">
              <input type="hidden" name="pasta" value={pasta.id} />
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Nível a conferir</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {NIVEIS.map((n) => (
                    <label key={n} className="flex cursor-pointer items-start gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm has-[:checked]:border-accent">
                      <input type="radio" name="nivel" value={n} defaultChecked={n === "SÊNIOR"} className="mt-1 accent-[var(--accent)]" />
                      <span>{ROTULO_NIVEL[n]}<span className="block text-[14px] leading-snug text-muted">{SIGNIFICADO_NIVEL[n]}</span></span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">O nível é cumulativo: Sênior confere também os itens Júnior, e Staff confere os três.</p>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Categorias</legend>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {CATEGORIAS.map((c) => (
                    <li key={c.slug}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-panel2 px-3 py-2 text-sm has-[:checked]:border-accent">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" name="categoria" value={c.slug} defaultChecked className="accent-[var(--accent)]" />
                          {c.nome}
                        </span>
                        <span className="shrink-0 text-xs text-muted" title="Itens por nível: Júnior, Sênior e Staff">J {contagem[c.slug]?.BASE ?? 0} · S {contagem[c.slug]?.["SÊNIOR"] ?? 0} · St {contagem[c.slug]?.STAFF ?? 0} · grupo {grupoDe(c.slug)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  J, S e St são os itens de cada nível (Júnior, Sênior e Staff). As categorias são lidas em {GRUPOS.length} grupos (o código é lido uma vez por grupo). Desmarcar todas as categorias de um grupo evita o custo dele.
                </p>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]">Gerar relatório</button>
                <Link href="/repositorios" className="text-xs text-muted hover:text-ink">Voltar</Link>
                {leitura && <span className="text-xs text-muted">A última leitura deste repositório custou US$ {leitura.custo.toFixed(2)}.</span>}
              </div>
            </form>
          </Card>
        }
        lateral={<Explica titulo="Sobre o relatório" itens={ajuda} />}
      />
    </Pagina>
  );
}
