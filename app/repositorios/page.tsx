import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Pagina, Carregando, Duas, Explica } from "../components/ui";
import { listarPastas, listarEstudos, existeNoDisco } from "../../lib/estudo";
import { listarRelatoriosDaPasta } from "../../lib/relatorio";
import { autorizarPastaAcao, revogarPastaAcao, iniciarEstudoAcao } from "../actions";

type Busca = Promise<Record<string, string | undefined>>;

export default function Repositorios({ searchParams }: { searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

const regras = [
  { t: "Só leitura, só o que você autorizar", d: "A Central nunca altera nada na pasta. Cada pasta precisa ser autorizada por você, e a autorização pode ser retirada a qualquer momento." },
  { t: "Cópia filtrada e temporária", d: "A IA não lê a pasta original. Ela lê uma cópia sem .env, chaves, .git, node_modules, binários e as instruções do próprio projeto. A cópia é apagada ao final." },
  { t: "Segredos nunca entram", d: "Arquivos sensíveis são ignorados pelo nome, sem serem abertos. Arquivos que parecem conter segredo não são copiados." },
  { t: "Auto-ingestão (suas pastas)", d: "O que a IA encontrar e confirmar no código entra direto na Biblioteca, já aprovado e com nível. Só fica retido para a sua decisão o que contradiz um item que já existe." },
  { t: "Repositório de terceiros, sempre com revisão", d: "O que vem de um link do GitHub nunca entra sozinho na Biblioteca. Fica em Aprovações, para você decidir item por item." },
  { t: "Citação conferida", d: "Achado que cita arquivo inexistente é descartado pela Central. Código no projeto não prova que a solução está correta." },
];

const corEstado = (e: string): "verde" | "amarelo" | "neutro" => (e === "Concluído" ? "verde" : e === "Em andamento" ? "amarelo" : "neutro");

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const q = await searchParams;
  await connection();
  const pastas = listarPastas();

  return (
    <Pagina>
      <PageHeader titulo="Repositórios" sub="Pastas autorizadas para leitura e os estudos feitos nelas." />
      {q.erro && (
        <div role="alert" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">{q.erro}</div>
      )}
      {q.ok && (
        <div role="status" className="mb-4 rounded-lg border border-line bg-panel px-4 py-3 text-sm">Autorizado somente para leitura.</div>
      )}
      <Duas
        principal={
          <>
            <Card titulo="Autorizar uma pasta">
              <form action={autorizarPastaAcao} className="flex flex-col gap-3">
                <label htmlFor="caminho" className="text-xs text-muted">Caminho completo da pasta do projeto</label>
                <input id="caminho" name="caminho" required maxLength={300} placeholder="C:\projetos\meu-site  ou  /home/voce/meu-site" className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm placeholder:text-muted" />
                <p className="text-xs leading-relaxed text-muted">
                  Ao autorizar, você permite que a Central leia uma cópia filtrada desta pasta. Ela não altera, não executa e não envia nada para fora, exceto o texto que a IA precisa ler (que passa pelo seu plano do Claude).
                </p>
                <div>
                  <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]">Autorizar somente leitura</button>
                </div>
              </form>
            </Card>

            <Card titulo="Adicionar por link do GitHub">
              <form action={autorizarPastaAcao} className="flex flex-col gap-3">
                <label htmlFor="link" className="text-xs text-muted">Endereço de um repositório público</label>
                <input id="link" name="caminho" required maxLength={300} placeholder="https://github.com/dono/repositorio" className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm placeholder:text-muted" />
                <p className="text-xs leading-relaxed text-muted">
                  Só repositórios públicos. A Central baixa apenas a versão atual, só quando você mandar estudar, e nunca executa nada do que baixou. O que a IA encontrar <strong className="font-semibold text-ink">não entra sozinho</strong> na Biblioteca: fica em Aprovações para você decidir. Prefira avisar a pessoa dona do repositório.
                </p>
                <div>
                  <button type="submit" className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-[var(--accent-soft)]">Adicionar para leitura</button>
                </div>
              </form>
            </Card>

            <Card titulo={`Pastas autorizadas (${pastas.length})`}>
              {pastas.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Nenhuma pasta autorizada ainda.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {pastas.map((p) => {
                    const estudos = listarEstudos(p.id);
                    const relatorios = listarRelatoriosDaPasta(p.id);
                    const existe = existeNoDisco(p);
                    return (
                      <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{p.nome}</p>
                            <p className="break-all text-[14px] text-muted">{p.origem_url ? "Repositório público de terceiros · GitHub" : p.caminho}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tom={p.ativa ? "verde" : "neutro"}>{p.ativa ? "Leitura autorizada" : "Autorização retirada"}</Badge>
                            {p.origem_url && <Badge tom="amarelo">Terceiros</Badge>}
                            {!existe && <Badge tom="amarelo">Pasta não encontrada</Badge>}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {p.ativa ? (
                            <>
                              <form action={iniciarEstudoAcao}>
                                <input type="hidden" name="pasta" value={p.id} />
                                <button type="submit" disabled={!existe} className="rounded-md border border-line px-3 py-1.5 text-xs text-ink hover:border-accent disabled:opacity-50">
                                  Estudar esta pasta com a IA
                                </button>
                              </form>
                              <Link href={`/relatorios/novo?pasta=${p.id}`} className={`rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-[var(--accent-soft)] ${existe ? "" : "pointer-events-none opacity-50"}`}>
                                Gerar relatório
                              </Link>
                              <form action={revogarPastaAcao}>
                                <input type="hidden" name="pasta" value={p.id} />
                                <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">Retirar autorização</button>
                              </form>
                            </>
                          ) : (
                            <form action={autorizarPastaAcao}>
                              <input type="hidden" name="caminho" value={p.caminho} />
                              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">Autorizar de novo</button>
                            </form>
                          )}
                        </div>
                        {relatorios.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-1.5 text-xs">
                            {relatorios.map((r) => (
                              <li key={r.id} className="flex items-center justify-between gap-3">
                                <Link href={`/relatorios/${r.id}`} className="text-accent">Relatório #{r.id}, {r.iniciado_em}</Link>
                                <span className="flex items-center gap-2 text-muted">
                                  {r.estado === "Concluído" && `US$ ${r.custo_usd.toFixed(2)}`}
                                  <Badge tom={corEstado(r.estado)}>{r.estado}</Badge>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {estudos.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-1.5 text-xs">
                            {estudos.map((e) => (
                              <li key={e.id} className="flex items-center justify-between gap-3">
                                <Link href={`/estudos/${e.id}`} className="text-accent">Estudo #{e.id}, {e.iniciado_em}</Link>
                                <span className="flex items-center gap-2 text-muted">
                                  {e.estado === "Concluído" && `${e.achados} item(ns)`}
                                  <Badge tom={corEstado(e.estado)}>{e.estado}</Badge>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        }
        lateral={<Explica titulo="Como a leitura é protegida" itens={regras} />}
      />
    </Pagina>
  );
}
