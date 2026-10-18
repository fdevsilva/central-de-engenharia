import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Carregando } from "./components/ui";
import { conectar } from "../lib/db";
import { listarPastas, listarEstudos } from "../lib/estudo";
import { totais } from "../lib/solucoes";
import { CATEGORIAS } from "../lib/categorias";
import { primeirosPassos } from "../lib/primeiros-passos";
import { carregarBibliotecaBaseAcao, ocultarPrimeirosPassosAcao } from "./actions";

export default function Home() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}

const icone = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const PASSOS = [
  { t: "Ler o repositório", d: "Link do GitHub ou pasta do seu computador, só em leitura.", cor: "#38d0ff", ic: icone(<><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="9" r="2.2" /><path d="M6 8.2v7.6M18 11.2c0 3-3 3.3-6 3.3" /></>) },
  { t: "Comparar com a Biblioteca", d: "13 categorias e 3 níveis, item por item.", cor: "#33dccb", ic: icone(<><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z" /><path d="M4 19a2 2 0 012-2h13" /><path d="M9 8h6M9 11h4" /></>) },
  { t: "Gerar o relatório", d: "Cobertura, ordem de correção e texto pronto para a sua IA.", cor: "#8b6bff", ic: icone(<><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" /><path d="M10 12h6M10 16h6" /></>) },
  { t: "Medir no PageSpeed", d: "Desempenho, acessibilidade e SEO de qualquer site.", cor: "#f59e0b", ic: icone(<><path d="M4 16a8 8 0 1116 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1.2" /></>) },
];

async function Conteudo() {
  await connection();
  const c = conectar();
  const pastas = listarPastas().filter((p) => p.ativa);
  const estudos = listarEstudos();
  const itens = totais().incorporadas;
  const relatorios = (c.prepare("SELECT COUNT(*) AS n FROM relatorios WHERE estado = 'Concluído'").get() as { n: number }).n;
  const medicoes = (c.prepare("SELECT COUNT(*) AS n FROM medicoes").get() as { n: number }).n;
  const inicio = await primeirosPassos();
  const mostrarPassos = !(inicio.obrigatoriosFeitos && inicio.oculto);
  const proximo = inicio.passos.find((p) => p.obrigatorio && !p.feito);

  const numeros = [
    { v: CATEGORIAS.length, r: "categorias" },
    { v: itens, r: "itens na Biblioteca" },
    { v: pastas.length, r: pastas.length === 1 ? "repositório lido" : "repositórios lidos" },
    { v: relatorios, r: relatorios === 1 ? "relatório gerado" : "relatórios gerados" },
    { v: medicoes, r: medicoes === 1 ? "medição PageSpeed" : "medições PageSpeed" },
  ];

  return (
    <div className="w-full p-8">
      <section
        className="relative flex min-h-[360px] items-center overflow-hidden rounded-3xl border border-line shadow-[0_30px_80px_-40px_rgba(47,123,255,0.7)]"
        style={{ backgroundImage: "url(/identidade/topo.webp)", backgroundSize: "cover", backgroundPosition: "right center" }}
      >
        {/* Escurece só o lado do texto, para a leitura ficar nítida e o cubo continuar à mostra. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,13,31,0.94)_0%,rgba(5,13,31,0.8)_34%,rgba(5,13,31,0.25)_62%,rgba(5,13,31,0)_80%)]" aria-hidden />
        <div className="relative max-w-2xl px-10 py-12">
          <p className="mb-3 inline-block rounded-full border border-line bg-[rgba(5,13,31,0.6)] px-3 py-1 text-xs tracking-wide text-[#8fe3ff] backdrop-blur">Engenharia de software, lida e medida</p>
          <h1 className="texto-brilho text-[44px] font-semibold leading-[1.08] tracking-tight">Central de Engenharia</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            Leia qualquer repositório, compare com uma Biblioteca de boas práticas e receba um relatório do que melhorar, pronto para colar na sua IA.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/repositorios" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#03201f]">Ler um repositório</Link>
            <Link href="/biblioteca" className="rounded-xl border border-line bg-[rgba(5,13,31,0.6)] px-5 py-2.5 text-sm font-medium text-ink backdrop-blur hover:border-[#38d0ff]">Abrir a Biblioteca</Link>
          </div>
        </div>
      </section>

      {mostrarPassos && (
        <section aria-label="Primeiros passos" className="mt-6 rounded-3xl border border-line bg-panel p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{inicio.obrigatoriosFeitos ? "Tudo configurado" : "Primeiros passos"}</h2>
              <p className="mt-1 text-sm text-muted">
                {inicio.obrigatoriosFeitos
                  ? "A Central está funcionando na sua conta. Os passos opcionais abaixo ampliam o que ela faz."
                  : "Siga a ordem abaixo. Ao terminar, a Central estará funcionando na sua conta."}
              </p>
            </div>
            <div className="min-w-[200px]">
              <div className="mb-1 flex justify-between text-xs text-muted"><span>{inicio.feitos} de {inicio.total}</span><span>{Math.round((inicio.feitos / inicio.total) * 100)}%</span></div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-panel2" aria-hidden>
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#38d0ff,#33dccb)]" style={{ width: `${Math.round((inicio.feitos / inicio.total) * 100)}%` }} />
              </div>
            </div>
          </div>
          <ol className="flex flex-col gap-2">
            {inicio.passos.map((p, i) => {
              const atual = proximo?.id === p.id;
              return (
                <li key={p.id} className={`rounded-2xl border px-4 py-3 ${p.feito ? "border-line bg-panel2 opacity-80" : atual ? "border-[#38d0ff] bg-[rgba(56,208,255,0.07)] shadow-[0_0_28px_-12px_rgba(56,208,255,0.7)]" : "border-line bg-panel2"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${p.feito ? "bg-accent text-[#03201f]" : "border border-line text-muted"}`} aria-hidden>
                        {p.feito ? "✓" : i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[18px] font-medium leading-snug">
                          {p.titulo}
                          {!p.obrigatorio && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs font-normal text-muted">opcional</span>}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">{p.descricao}</p>
                        {!p.feito && p.ajuda && (
                          <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-muted">
                            {p.ajuda.map((a) => <li key={a}>{a}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                    {!p.feito && p.acaoBiblioteca && (
                      <form action={carregarBibliotecaBaseAcao}>
                        <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#03201f]">Carregar a Biblioteca</button>
                      </form>
                    )}
                    {!p.feito && p.href && (
                      <Link href={p.href} className={`rounded-xl px-4 py-2 text-sm font-semibold ${atual ? "bg-accent text-[#03201f]" : "border border-line text-ink hover:border-[#38d0ff]"}`}>{p.rotuloLink}</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {inicio.obrigatoriosFeitos && (
            <form action={ocultarPrimeirosPassosAcao} className="mt-4">
              <input type="hidden" name="ocultar" value="1" />
              <button type="submit" className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-ink">Ocultar este quadro</button>
            </form>
          )}
        </section>
      )}

      <section aria-label="Números" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {numeros.map((n) => (
          <div key={n.r} className="rounded-2xl border border-line bg-panel px-5 py-4">
            <div className="texto-brilho text-[34px] font-semibold leading-none tabular-nums">{n.v}</div>
            <div className="mt-2 text-sm text-muted">{n.r}</div>
          </div>
        ))}
      </section>

      <section aria-label="Como funciona" className="mt-6 rounded-3xl border border-line bg-panel p-6">
        <h2 className="mb-5 text-lg font-semibold">Como funciona</h2>
        <ol className="grid gap-3 lg:grid-cols-4">
          {PASSOS.map((p, i) => (
            <li key={p.t} className="relative rounded-2xl border border-line bg-panel2 p-5">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ color: p.cor, background: `${p.cor}1f`, boxShadow: `inset 0 0 0 1px ${p.cor}55` }}>
                {p.ic}
              </span>
              <p className="text-xs text-muted">Passo {i + 1}</p>
              <h3 className="mt-0.5 text-[18px] font-semibold leading-snug">{p.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.d}</p>
              {i < PASSOS.length - 1 && <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-xl text-[#38d0ff] lg:block" aria-hidden>→</span>}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Repositórios lidos" className="mt-6 rounded-3xl border border-line bg-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Repositórios lidos</h2>
          <Link href="/repositorios" className="text-sm text-[#38d0ff] hover:underline">Gerenciar</Link>
        </div>
        {pastas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum repositório ainda. Autorize uma pasta ou cole um link do GitHub em Repositórios.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {pastas.map((p) => {
              const ultimo = estudos.find((e) => e.pasta_id === p.id);
              return (
                <li key={p.id}>
                  <Link
                    href={ultimo ? `/estudos/${ultimo.id}` : "/repositorios"}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel2 px-4 py-3 text-sm transition-colors hover:border-[#38d0ff] hover:shadow-[0_0_24px_-8px_rgba(56,208,255,0.6)]"
                  >
                    <span className="min-w-0 truncate font-medium">{p.nome}</span>
                    <span className="shrink-0 text-xs text-muted">{ultimo ? ultimo.iniciado_em.slice(0, 16) : "ainda não lido"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
