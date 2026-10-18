import Link from "next/link";

export function PageHeader({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {acao && (
        <Link href={acao.href} className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-[#04211c]">
          {acao.label}
        </Link>
      )}
    </div>
  );
}

export function Card({
  titulo,
  extra,
  children,
}: {
  titulo?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      {titulo && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

const tons: Record<string, string> = {
  verde: "bg-[var(--accent-soft)] text-accent",
  amarelo: "bg-[rgba(229,185,78,0.12)] text-warn",
  neutro: "bg-panel2 text-muted",
};

export function Badge({ children, tom = "neutro" }: { children: React.ReactNode; tom?: keyof typeof tons }) {
  return <span className={`rounded-full px-2 py-0.5 text-[14px] ${tons[tom]}`}>{children}</span>;
}

export function tomValidacao(estado: string): "verde" | "amarelo" | "neutro" {
  if (estado.startsWith("Validado")) return "verde";
  if (["Experimental", "Conflitante", "Desatualizado"].includes(estado)) return "amarelo";
  return "neutro";
}

export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col divide-y divide-line">{children}</ul>;
}

export function Linha({
  href,
  titulo,
  texto,
  direita,
}: {
  href?: string;
  titulo: string;
  texto?: string;
  direita?: React.ReactNode;
}) {
  const conteudo = (
    <>
      <div className="min-w-0">
        <div className="text-sm">{titulo}</div>
        {texto && <div className="mt-0.5 text-xs text-muted">{texto}</div>}
      </div>
      {direita && <div className="shrink-0 text-xs text-muted">{direita}</div>}
    </>
  );
  const cls = "flex items-center justify-between gap-4 py-3";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${cls} hover:text-accent`}>
          {conteudo}
        </Link>
      ) : (
        <div className={cls}>{conteudo}</div>
      )}
    </li>
  );
}

export function Duas({ principal, lateral }: { principal: React.ReactNode; lateral: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
      <div className="flex min-w-0 flex-col gap-4">{principal}</div>
      <div className="flex min-w-0 flex-col gap-4">{lateral}</div>
    </div>
  );
}

export function Explica({ titulo, itens }: { titulo: string; itens: { t: string; d: string; tag?: string }[] }) {
  return (
    <Card titulo={titulo}>
      <ul className="flex flex-col divide-y divide-line">
        {itens.map((i) => (
          <li key={i.t} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              {i.tag && <span className="text-xs text-accent">{i.tag}</span>}
              {i.t}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{i.d}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Carregando() {
  return <div className="p-8 text-sm text-muted">Carregando</div>;
}

export function Pagina({ children }: { children: React.ReactNode }) {
  return <div className="w-full p-8">{children}</div>;
}

export function Campo({ id, label, placeholder, area, maxLength, required }: { id: string; label: string; placeholder?: string; area?: boolean; maxLength?: number; required?: boolean }) {
  const cls = "w-full rounded-md border border-line bg-panel2 px-3 text-sm placeholder:text-muted";
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-muted">
        {label}
      </label>
      {area ? (
        <textarea id={id} name={id} placeholder={placeholder} rows={4} maxLength={maxLength} required={required} className={`${cls} py-2`} />
      ) : (
        <input id={id} name={id} placeholder={placeholder} maxLength={maxLength} required={required} className={`${cls} h-10`} />
      )}
    </div>
  );
}

export function Botao({
  children,
  primario = true,
  enviar = false,
}: {
  children: React.ReactNode;
  primario?: boolean;
  enviar?: boolean;
}) {
  return (
    <button
      type={enviar ? "submit" : "button"}
      className={`rounded-md px-4 py-2 text-sm font-medium ${
        primario ? "bg-accent text-[#04211c]" : "border border-line text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
