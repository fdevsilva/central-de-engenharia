"use client";

import { useTransition } from "react";
import { medirSite } from "../actions";

const caixa = "w-full rounded-md border border-line bg-panel2 px-3 text-sm placeholder:text-muted";

export default function FormMedir({ slug, urlInicial }: { slug: string; urlInicial: string }) {
  const [medindo, iniciar] = useTransition();

  function acao(dados: FormData) {
    iniciar(async () => {
      await medirSite(dados);
    });
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="_projeto" value={slug} />
      <div>
        <label htmlFor="url" className="mb-1 block text-xs text-muted">Endereço público do site (https)</label>
        <input id="url" name="url" required defaultValue={urlInicial} placeholder="https://exemplo.com.br" className={`${caixa} h-10`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="dispositivo" className="mb-1 block text-xs text-muted">Dispositivo</label>
          <select id="dispositivo" name="dispositivo" defaultValue="mobile" className={`${caixa} h-10`}>
            <option value="mobile">Celular (mobile)</option>
            <option value="desktop">Desktop</option>
          </select>
        </div>
        <div>
          <label htmlFor="pagina" className="mb-1 block text-xs text-muted">Página (opcional)</label>
          <input id="pagina" name="pagina" placeholder="home" className={`${caixa} h-10`} />
        </div>
        <div>
          <label htmlFor="rotulo" className="mb-1 block text-xs text-muted">Rótulo da medição</label>
          <input id="rotulo" name="rotulo" required list="rotulos" placeholder="Antes, Depois ou Final" className={`${caixa} h-10`} />
          <datalist id="rotulos">
            <option value="Antes" />
            <option value="Depois" />
            <option value="Final" />
          </datalist>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="tres" className="mt-1 accent-[var(--accent)]" />
        <span>
          Medir 3 vezes e usar a mediana
          <span className="block text-xs text-muted">Evita que uma medição isolada ruim, causada pela rede, distorça o resultado. Leva mais tempo.</span>
        </span>
      </label>
      <div className="rounded-md border border-line bg-panel2 px-3 py-2.5 text-xs leading-relaxed text-muted">
        Ao medir, o endereço acima é enviado ao Google PageSpeed Insights, um serviço externo. Nada mais do projeto é enviado.
      </div>
      <div>
        <button
          type="submit"
          disabled={medindo}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#04211c] disabled:opacity-60"
        >
          {medindo ? "Medindo, isso pode levar até alguns minutos" : "Medir agora (envia o endereço ao Google)"}
        </button>
      </div>
    </form>
  );
}
