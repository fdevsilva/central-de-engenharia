import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Carregando, Duas, tomValidacao } from "../../components/ui";
import { obterMaterial, obterAnalise } from "../../../lib/db";
import { listarPorMaterial } from "../../../lib/solucoes";
import { nomeCategoria } from "../../../lib/categorias";

export default function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const material = Number.isInteger(Number(id)) ? obterMaterial(Number(id)) : undefined;
  if (!material) notFound();
  const analise = obterAnalise(material.id);
  const topicos: string[] = analise ? JSON.parse(analise.topicos) : [];
  const derivadas = listarPorMaterial(material.id);

  return (
    <Pagina>
      <PageHeader titulo={material.nome} sub={`Versão ${material.versao} · material de origem`} />
      {material.observacao && (
        <div role="status" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">
          {material.observacao}
        </div>
      )}
      <Duas
        principal={
          <Card titulo="Análise automática">
            {analise ? (
              <>
                <dl className="mb-5 grid grid-cols-3 gap-3 text-sm">
                  <div><dt className="text-xs text-muted">Linhas</dt><dd>{analise.linhas}</dd></div>
                  <div><dt className="text-xs text-muted">Palavras</dt><dd>{analise.palavras}</dd></div>
                  <div><dt className="text-xs text-muted">Categoria sugerida</dt><dd>{nomeCategoria(analise.categoria)}</dd></div>
                </dl>
                <p className="mb-4 text-xs leading-relaxed text-muted">
                  A sugestão é por palavras-chave e pode errar. A categoria definitiva é escolhida por você ao criar uma solução.
                </p>
                <h3 className="mb-2 text-xs text-muted">Tópicos identificados</h3>
                {topicos.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum tópico detectado.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {topicos.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Sem análise.</p>
            )}
          </Card>
        }
        lateral={
          <>
            <Card titulo="Origem">
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Recebido em</dt><dd>{material.recebido_em}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Tamanho</dt><dd>{(material.tamanho / 1024).toFixed(1)} KB</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">SHA-256</dt><dd className="font-mono text-xs">{material.hash.slice(0, 16)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Original</dt><dd>Preservado</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Estado</dt><dd><Badge tom={tomValidacao(material.estado)}>{material.estado}</Badge></dd></div>
              </dl>
            </Card>
            <Card titulo={`Soluções criadas a partir dele (${derivadas.length})`}>
              {derivadas.length > 0 && (
                <ul className="mb-4 flex flex-col gap-2 text-sm">
                  {derivadas.map((s) => (
                    <li key={s.id}>
                      <Link href={`/biblioteca/solucoes/${s.id}`} className="hover:text-accent">{s.titulo}</Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-3 text-xs leading-relaxed text-muted">
                O material em si não entra na Biblioteca. O que entra são soluções extraídas dele, com a sua aprovação.
              </p>
              <Link
                href={`/biblioteca/solucoes/manual?material=${material.id}`}
                className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]"
              >
                Criar solução a partir deste material
              </Link>
            </Card>
          </>
        }
      />
    </Pagina>
  );
}
