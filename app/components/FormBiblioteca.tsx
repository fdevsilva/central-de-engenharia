"use client";

import { useRef, useTransition } from "react";
import { enviarMensagemBiblioteca } from "../actions";
import ProgressoEstudo from "./ProgressoEstudo";

export default function FormBiblioteca({ chat, primeira }: { chat: number | null; primeira: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [analisando, iniciar] = useTransition();

  function acao(dados: FormData) {
    iniciar(async () => {
      await enviarMensagemBiblioteca(dados);
      ref.current?.reset();
    });
  }

  return (
    <form ref={ref} action={acao} className="flex flex-col gap-2 border-t border-line p-4">
      {analisando && (
        <ProgressoEstudo modo="estudo" inicio="" passos={0} maxPassos={1} etapa="" lendo="A IA está lendo, conferindo a Biblioteca e incorporando" />
      )}
      {chat && <input type="hidden" name="chat" value={chat} />}
      <label htmlFor="msg" className="sr-only">Conteúdo ou ideia</label>
      <textarea
        id="msg"
        name="msg"
        required
        rows={primeira ? 9 : 4}
        maxLength={100000}
        readOnly={analisando}
        placeholder={
          primeira
            ? "Cole um texto ou conte a ideia que você quer trazer. Não precisa escolher categoria: a Central identifica, confere o que a Biblioteca já tem e incorpora."
            : "Responda, peça um ajuste ou cole outro conteúdo"
        }
        className={`w-full resize-y rounded-md border border-line bg-panel2 px-3 py-2 text-sm placeholder:text-muted ${analisando ? "opacity-60" : ""}`}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] text-muted">Textos curtos são lidos na hora. Textos maiores que 1.500 caracteres vão para a leitura em trechos, com barra de progresso. O texto fica guardado como original.</span>
        <button type="submit" disabled={analisando} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c] disabled:opacity-60">
          {analisando ? "Analisando" : "Analisar"}
        </button>
      </div>
    </form>
  );
}
