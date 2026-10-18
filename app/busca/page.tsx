import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Card, Pagina, Carregando } from "../components/ui";
import Resultados from "../components/Resultados";
import { buscar } from "../../lib/busca";

export default function Busca({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = ((await searchParams).q ?? "").slice(0, 200).trim();
  await connection();
  const resultados = q ? buscar(q, { limite: 40, tipos: ["solucao", "material"] }) : [];
  return (
    <Pagina>
      <PageHeader titulo="Busca" sub={q ? `Resultados para "${q}". A busca é local e não usa tokens.` : "Digite algo na barra de busca no topo."} />
      <Card>
        {!q ? (
          <p className="py-4 text-sm text-muted">Pesquise nas soluções da Biblioteca e nos materiais recebidos.</p>
        ) : resultados.length === 0 ? (
          <p className="py-4 text-sm text-muted">Nada encontrado. Tente outras palavras.</p>
        ) : (
          <Resultados itens={resultados} />
        )}
      </Card>
    </Pagina>
  );
}
