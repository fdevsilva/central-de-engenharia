import Link from "next/link";
import { Badge } from "./ui";
import { partirTrecho, type Resultado } from "../../lib/busca";

const rotulo: Record<string, string> = {
  anotacao: "Documentação",
  mensagem: "Reunião",
  solucao: "Biblioteca",
  material: "Material",
  projeto: "Projeto",
};

export default function Resultados({ itens }: { itens: Resultado[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {itens.map((r) => (
        <li key={`${r.tipo}-${r.refId}`} className="py-3 first:pt-0 last:pb-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge>{rotulo[r.tipo]}</Badge>
            {r.antiga && <Badge tom="amarelo">Versão anterior</Badge>}
            <Link href={r.href} className="text-sm font-medium hover:text-accent">{r.titulo}</Link>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            {partirTrecho(r.trecho).map((p, i) =>
              p.destaque ? <mark key={i} className="rounded-sm bg-[var(--accent-soft)] px-0.5 text-accent">{p.texto}</mark> : <span key={i}>{p.texto}</span>,
            )}
          </p>
          <p className="mt-1 text-[14px] text-muted">{r.detalhe}</p>
        </li>
      ))}
    </ul>
  );
}
