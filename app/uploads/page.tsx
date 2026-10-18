import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { PageHeader, Card, Botao, Pagina, Duas, Explica, Carregando, Badge } from "../components/ui";
import AtualizarSozinho from "../components/AtualizarSozinho";
import ProgressoEstudo from "../components/ProgressoEstudo";
import { enviarArquivos } from "../actions";
import { lerStatusAuto } from "../../lib/auto-ingestao";

const passos = [
  { t: "Original preservado", d: "O arquivo enviado é gravado uma única vez, protegido contra escrita, com impressão digital (SHA-256). Nunca é editado, renomeado ou apagado." },
  { t: "Leitura automática (TXT e MD)", d: "A IA lê o texto em trechos, identifica a categoria de cada prática, confere o que a Biblioteca já tem e decide o nível. O que é novo entra direto na Biblioteca." },
  { t: "Somar, não duplicar", d: "Se algo parecido já existe, a IA soma o que o texto traz a mais ao item existente (conceitos novos e uma nota de reforço) e, se couber, inclui as categorias novas." },
  { t: "Retenção só por conflito", d: "Fica esperando a sua decisão apenas o que contradiz um item já existente. A conversa mostra o motivo do conflito." },
];

const estados = [
  { t: "Recebido", d: "Entrou na Biblioteca pela leitura automática, ainda sem validação." },
  { t: "Analisado", d: "Classificado e conferido pela Central." },
  { t: "Conflitante", d: "Mesmo nome, conteúdo diferente de uma versão anterior do arquivo." },
  { t: "Validado, experimental ou desatualizado", d: "Estados que você define depois, conforme a evidência." },
];

type Busca = Promise<Record<string, string | undefined>>;

export default function Uploads({ searchParams }: { searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const q = await searchParams;
  await connection();
  const status = lerStatusAuto();
  const andando = status?.estado === "Em andamento";
  const pct = status && status.total > 0 ? Math.round((status.feitos / status.total) * 100) : 0;

  return (
    <Pagina>
      <AtualizarSozinho ativo={andando} />
      <PageHeader titulo="Novos conhecimentos" sub="Envie materiais. Arquivos de texto são lidos pela IA e distribuídos na Biblioteca. Nada é substituído nem apagado." />
      {q.erro && q.erro !== "1" && (
        <div role="alert" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">{q.erro}</div>
      )}
      <Duas
        principal={
          <>
            {status && (
              <Card titulo="Leitura automática">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tom={status.estado === "Concluído" ? "verde" : "amarelo"}>{status.estado}</Badge>
                  <span className="text-sm text-muted">{status.arquivos}</span>
                </div>
                {andando ? (
                  <ProgressoEstudo
                    modo="trechos"
                    inicio={status.iniciado}
                    passos={status.feitos}
                    maxPassos={status.total}
                    etapa=""
                    lendo={`Lendo o trecho ${Math.min(status.feitos + 1, status.total)} de ${status.total}`}
                  />
                ) : (
                  <div className="mb-2">
                    <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                      <span>{status.total} {status.total === 1 ? "trecho lido" : "trechos lidos"}</span>
                      <span className="tabular-nums text-muted">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel2" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted">Incorporados</dt><dd className="text-[21px] font-semibold">{status.incorporadas}</dd></div>
                  <div><dt className="text-xs text-muted">Somados a existentes</dt><dd className="text-[21px] font-semibold">{status.reforcadas}</dd></div>
                  <div><dt className="text-xs text-muted">Já existiam</dt><dd className="text-[21px] font-semibold">{status.semNovidade}</dd></div>
                  <div><dt className="text-xs text-muted">Retidos por conflito</dt><dd className="text-[21px] font-semibold">{status.retidas}</dd></div>
                </dl>
                {status.erro && <p role="alert" className="mt-3 text-sm text-warn">{status.erro}</p>}
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {andando ? "Esta página se atualiza sozinha. Você pode sair e voltar depois. " : ""}
                  Custo até agora: US$ {status.custo.toFixed(2)}.{" "}
                  <Link href={`/biblioteca/solucoes/nova?chat=${status.chatId}`} className="text-accent">Ver a conversa e os itens</Link>
                </p>
              </Card>
            )}
            <Card>
              <form action={enviarArquivos}>
                <label
                  htmlFor="arquivos"
                  className="flex min-h-72 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-6 text-center text-sm text-muted hover:border-accent focus-within:border-accent"
                >
                  Clique para escolher os arquivos
                  <span className="text-xs">TXT e MD são lidos pela IA na hora. JSON, código, CSV, PDF e DOCX são guardados. Até 20 arquivos de 5 MB.</span>
                  <input id="arquivos" name="arquivos" type="file" multiple required className="mt-2 text-xs" />
                </label>
                <div className="mt-5">
                  <Botao enviar>Enviar e ler</Botao>
                </div>
              </form>
            </Card>
          </>
        }
        lateral={
          <>
            <Explica titulo="Como funciona" itens={passos} />
            <Explica titulo="Estados do conhecimento" itens={estados} />
          </>
        }
      />
    </Pagina>
  );
}
