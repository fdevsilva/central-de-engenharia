import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Badge, Carregando } from "../../../components/ui";
import FormBiblioteca from "../../../components/FormBiblioteca";
import { obterChat, listarMsgs, listarPropostas, listarChats, type Proposta } from "../../../../lib/biblioteca-chat";
import { conectar } from "../../../../lib/db";
import { CATEGORIAS, nomeCategoria } from "../../../../lib/categorias";
import { NIVEIS, ROTULO_NIVEL } from "../../../../lib/solucoes";
import { incorporarPropostaChat, descartarPropostaChat } from "../../../actions";

type Busca = Promise<Record<string, string | undefined>>;

export default function Nova({ searchParams }: { searchParams: Busca }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

const caixa = "w-full rounded-md border border-line bg-panel2 px-3 text-sm";

function idPorTitulo(titulo: string): number | null {
  const r = conectar().prepare("SELECT id FROM solucoes WHERE lower(titulo) = lower(?) ORDER BY id LIMIT 1").get(titulo) as { id: number } | undefined;
  return r?.id ?? null;
}

function Cartao({ p, chat }: { p: Proposta; chat: number }) {
  const cats: string[] = JSON.parse(p.categorias);
  const decidida = p.estado !== "Pendente";
  const idExistente = p.existente ? idPorTitulo(p.existente) : null;
  const rotuloRelacao =
    p.relacao === "nova" ? <Badge tom="verde">Nova: a Biblioteca ainda não tem</Badge>
    : p.relacao === "parcial" ? <Badge tom="amarelo">Complementa um item existente</Badge>
    : <Badge tom="amarelo">Já existe</Badge>;
  return (
    <div className={`rounded-lg border p-4 ${decidida ? "border-line opacity-75" : "border-accent/40"} bg-panel2`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium leading-snug">{p.titulo}</h3>
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {rotuloRelacao}
          {decidida && <Badge tom={p.estado === "Incorporada" ? "verde" : "neutro"}>{p.estado}</Badge>}
        </span>
      </div>
      {p.conflito && !decidida && (
        <p role="alert" className="mt-2 rounded-md border border-warn/40 bg-[rgba(229,185,78,0.06)] px-3 py-2 text-xs leading-relaxed">
          <strong className="font-semibold">Retido por conflito com:</strong> {p.conflito}
        </p>
      )}
      {p.existente && (
        <p className="mt-1.5 text-xs text-muted">
          {p.relacao === "duplicada" ? "Equivale a" : "Relacionado a"}:{" "}
          {idExistente ? <Link href={`/biblioteca/solucoes/${idExistente}`} className="text-accent">{p.existente}</Link> : p.existente}
        </p>
      )}
      <p className="mt-2 text-[14px] text-muted">
        {p.tipo} · vai para {cats.map((c, i) => (i === 0 ? `${nomeCategoria(c)} (principal)` : nomeCategoria(c))).join(", ")}
        {p.nivel ? ` · nível decidido pela IA: ${ROTULO_NIVEL[p.nivel]}` : " · sem nível (não é um requisito exigível)"}
      </p>
      {p.resumo && <p className="mt-2 text-sm leading-relaxed">{p.resumo}</p>}
      {p.pilar && <p className="mt-1 text-xs text-muted">Pilar: {p.pilar}</p>}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-accent">Ver nível, explicação e texto da proposta</summary>
        {p.nivel && p.justificativa_nivel && (
          <p className="mt-2 text-sm leading-relaxed"><strong className="font-semibold">Por que {ROTULO_NIVEL[p.nivel]}:</strong> {p.justificativa_nivel}</p>
        )}
        {p.explicacao && (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed">
            {p.explicacao.split("\n").map((l) => <li key={l}>{l.replace(" :: ", ": ")}</li>)}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Texto da proposta (a partir da sua fonte):</p>
        <p className="whitespace-pre-wrap text-xs leading-relaxed">{p.descricao}</p>
        {p.limitacoes && <p className="mt-2 text-xs leading-relaxed text-muted">Limitações: {p.limitacoes}</p>}
      </details>
      {p.estado === "Incorporada" && p.solucao_id && (
        <Link href={`/biblioteca/solucoes/${p.solucao_id}`} className="mt-2 inline-block text-xs text-accent">Abrir na Biblioteca</Link>
      )}
      {!decidida && (
        <>
          <form action={incorporarPropostaChat} className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
            <input type="hidden" name="proposta" value={p.id} />
            <input type="hidden" name="chat" value={chat} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`pc-${p.id}`} className="mb-1 block text-[14px] text-muted">Categoria principal</label>
                <select id={`pc-${p.id}`} name="principal" defaultValue={cats[0]} className={`${caixa} h-9`}>
                  {CATEGORIAS.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`pn-${p.id}`} className="mb-1 block text-[14px] text-muted">Nível</label>
                <select id={`pn-${p.id}`} name="nivel" defaultValue={p.nivel ?? ""} className={`${caixa} h-9`}>
                  <option value="">Sem nível</option>
                  {NIVEIS.map((n) => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
                </select>
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-muted">Ajustar outras categorias e a origem</summary>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {CATEGORIAS.map((c) => (
                  <label key={c.slug} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="extras" value={c.slug} defaultChecked={cats.slice(1).includes(c.slug)} className="accent-[var(--accent)]" />
                    {c.nome}
                  </label>
                ))}
              </div>
              <label htmlFor={`po-${p.id}`} className="mb-1 mt-3 block text-[14px] text-muted">Origem (de onde veio este conteúdo)</label>
              <input id={`po-${p.id}`} name="origem" defaultValue={p.origem} placeholder="Opcional" className={`${caixa} h-9`} />
            </details>
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="mesmo" value={p.relacao === "duplicada" ? "1" : "0"} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c]">
                {p.relacao === "duplicada" ? "Incorporar mesmo assim" : "Incorporar à Biblioteca"}
              </button>
            </div>
          </form>
          <form action={descartarPropostaChat} className="mt-2">
            <input type="hidden" name="proposta" value={p.id} />
            <input type="hidden" name="chat" value={chat} />
            <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink">Descartar esta proposta</button>
          </form>
        </>
      )}
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const q = await searchParams;
  await connection();
  const id = Number(q.chat);
  const chat = Number.isInteger(id) && id > 0 ? obterChat(id) : undefined;
  const msgs = chat ? listarMsgs(chat.id) : [];
  const propostas = chat ? listarPropostas(chat.id) : [];
  const anteriores = listarChats(8).filter((c) => c.id !== chat?.id);
  const ultima = [...msgs].reverse().find((m) => m.papel === "claude");

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Nova solução</h1>
          <p className="mt-1 text-sm text-muted">Conte a ideia ou cole um texto. A Central identifica a categoria, confere o que a Biblioteca já tem e incorpora sozinha o que é novo. O parecido é somado ao item existente, e só o que conflita espera por você.</p>
        </div>
        <Link href="/biblioteca/solucoes/manual" className="text-xs text-muted hover:text-ink">Cadastrar manualmente, sem a IA</Link>
      </div>
      {q.erro && <div role="alert" className="rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">{q.erro}</div>}
      {q.incorporada && (
        <div role="status" className="rounded-lg border border-line bg-panel px-4 py-3 text-sm">
          Incorporada à Biblioteca. <Link href={`/biblioteca/solucoes/${q.incorporada}`} className="text-accent">Abrir a solução</Link>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-h-0 flex-col rounded-xl border border-line bg-panel">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {msgs.length === 0 ? (
              <div className="m-auto max-w-md text-center text-sm leading-relaxed text-muted">
                <p>Cole abaixo o conteúdo que você quer trazer, de qualquer lugar, ou descreva a ideia.</p>
                <p className="mt-2">A Central diz em que categoria vai, se a Biblioteca já tem isso (completo, em parte ou nada) e já incorpora o que é novo. O que se parece com algo existente é somado a esse item.</p>
              </div>
            ) : (
              msgs.map((m) => {
                const doBloco = propostas.filter((p) => p.msg_id === m.id);
                const estilo = m.papel === "usuario" ? "self-end bg-panel2" : m.papel === "sistema" ? "border-warn/40 bg-[rgba(229,185,78,0.06)]" : "bg-[var(--accent-soft)]";
                return (
                  <div key={m.id} className="flex flex-col gap-3">
                    <div className={`max-w-[90%] rounded-lg border border-line p-3 ${estilo}`}>
                      <div className="mb-1 text-xs text-muted">{m.papel === "usuario" ? "Você" : m.papel === "sistema" ? "Aviso" : "IA"} · {m.criado_em.slice(11, 16)}</div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.texto}</div>
                    </div>
                    {doBloco.length > 0 && (
                      <div className="flex flex-col gap-3 pl-3">
                        {doBloco.map((p) => <Cartao key={p.id} p={p} chat={chat!.id} />)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <FormBiblioteca chat={chat?.id ?? null} primeira={msgs.length === 0} />
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <section className="rounded-xl border border-line bg-panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Como funciona</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-4 text-xs leading-relaxed text-muted">
              <li>A Central procura na Biblioteca, sem custo, o que mais se parece com o seu texto.</li>
              <li>A IA lê o texto e a lista de tudo o que já existe, e diz se é novo, complementa algo ou já existe.</li>
              <li>Cada prática distinta entra direto na Biblioteca, com categoria e nível decididos pela IA, ou é somada ao item parecido. Só o que contradiz um item existente fica retido para você decidir aqui.</li>
              <li>O texto que você colou fica guardado como original.</li>
            </ol>
          </section>
          {ultima && ultima.custo_usd !== null && (
            <section className="rounded-xl border border-line bg-panel p-5">
              <h2 className="mb-2 text-sm font-semibold">Consumo</h2>
              <p className="text-xs text-muted">Última análise: US$ {ultima.custo_usd.toFixed(3)}</p>
            </section>
          )}
          {anteriores.length > 0 && (
            <section className="rounded-xl border border-line bg-panel p-5">
              <h2 className="mb-3 text-sm font-semibold">Conversas anteriores</h2>
              <ul className="flex flex-col gap-2 text-xs">
                {anteriores.map((c) => (
                  <li key={c.id}><Link href={`/biblioteca/solucoes/nova?chat=${c.id}`} className="line-clamp-2 text-accent">{c.titulo}</Link></li>
                ))}
              </ul>
            </section>
          )}
          {chat && <Link href="/biblioteca/solucoes/nova" className="text-xs text-accent">Começar uma conversa nova</Link>}
        </aside>
      </div>
    </div>
  );
}
