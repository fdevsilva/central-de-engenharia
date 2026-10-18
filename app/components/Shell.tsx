"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const menu = [
  { href: "/", label: "Início", icone: I(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></>) },
  { href: "/aprovacoes", label: "Aprovações", icone: I(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>) },
  { href: "/biblioteca", label: "Biblioteca de Engenharia", icone: I(<><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z" /><path d="M4 19a2 2 0 012-2h13" /></>) },
  { href: "/repositorios", label: "Repositórios", icone: I(<><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="9" r="2.2" /><path d="M6 8.2v7.6M18 11.2c0 3-3 3.3-6 3.3" /></>) },
  { href: "/pagespeed", label: "PageSpeed", icone: I(<><path d="M4 16a8 8 0 1116 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1.2" /></>) },
  { href: "/uploads", label: "Novos conhecimentos", icone: I(<><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></>) },
  { href: "/configuracoes", label: "Configurações", icone: I(<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z" /></>) },
];

function Marca() {
  return (
    <svg viewBox="0 0 48 48" width="38" height="38" aria-hidden>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8fe3ff" />
          <stop offset="1" stopColor="#2f7bff" />
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38d0ff" />
          <stop offset="1" stopColor="#1646a8" />
        </linearGradient>
      </defs>
      <path d="M24 3l15 8.5v17L24 37 9 28.5v-17L24 3z" fill="url(#g2)" opacity="0.35" />
      <path d="M24 3l15 8.5L24 20 9 11.5 24 3z" fill="url(#g1)" />
      <path d="M9 11.5L24 20v17L9 28.5v-17z" fill="#2f7bff" opacity="0.75" />
      <path d="M39 11.5L24 20v17l15-8.5v-17z" fill="#33dccb" opacity="0.6" />
      <path d="M12 41l12 5 12-5" stroke="#38d0ff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

function Links({ path }: { path: string }) {
  const ativo = (href: string) => (path !== "" && (href === "/" ? path === "/" : path.startsWith(href)));
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {menu.map((m) => {
        const a = ativo(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={a ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              a
                ? "bg-[linear-gradient(90deg,rgba(56,208,255,0.2),rgba(56,208,255,0.04))] text-ink shadow-[inset_0_0_0_1px_rgba(56,208,255,0.28)]"
                : "text-muted hover:bg-[rgba(56,208,255,0.07)] hover:text-ink"
            }`}
          >
            {a && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[linear-gradient(180deg,#38d0ff,#33dccb)]" aria-hidden />}
            <span className={a ? "text-[#38d0ff]" : "text-[#7fb6e8] group-hover:text-[#38d0ff]"}>{m.icone}</span>
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MenuAtivo() {
  return <Links path={usePathname()} />;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-panel px-3 py-5">
        <Link href="/" className="mb-7 flex items-center gap-3 px-3">
          <Marca />
          <span>
            <span className="block text-[18px] font-semibold leading-tight tracking-tight">Central de Engenharia</span>
            <span className="block text-xs text-muted">Leia, compare e melhore</span>
          </span>
        </Link>
        <Suspense fallback={<Links path="" />}>
          <MenuAtivo />
        </Suspense>
        <div className="mt-auto rounded-xl border border-line bg-panel2 px-3 py-3 text-xs">
          <div className="flex items-center gap-2 text-ink">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgba(51,220,203,0.9)]" aria-hidden />
            Claude Code
          </div>
          <div className="mt-1 text-muted">Usa o seu login, só em leitura</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-[rgba(5,13,31,0.55)] px-6 backdrop-blur">
          <form action="/busca" method="get" role="search" className="relative w-full max-w-xl">
            <label htmlFor="busca" className="sr-only">Buscar</label>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7fb6e8]" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4 4" />
            </svg>
            <input
              id="busca"
              name="q"
              type="search"
              maxLength={200}
              placeholder="Buscar soluções e materiais"
              className="h-9 w-full rounded-lg border border-line bg-panel pl-10 pr-3 text-sm placeholder:text-muted"
            />
          </form>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgba(51,220,203,0.9)]" aria-hidden />
            Claude Code conectado
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
