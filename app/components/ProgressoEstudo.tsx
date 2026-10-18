"use client";

import { useEffect, useState } from "react";

// Mostra que o trabalho está vivo: tempo decorrido, andamento e uma barra.
// Modo "estudo": a porcentagem é estimada pelo limite de passos, porque o tamanho real da leitura só se sabe no fim.
// Modo "trechos": a porcentagem é real, trechos lidos sobre o total.
export default function ProgressoEstudo({
  inicio, passos, maxPassos, etapa, lendo, modo = "estudo",
}: { inicio: string; passos: number; maxPassos: number; etapa: string; lendo: string; modo?: "estudo" | "trechos" }) {
  const [agora, setAgora] = useState<number | null>(null);
  const [montadoEm, setMontadoEm] = useState<number | null>(null);
  useEffect(() => {
    setMontadoEm(Date.now());
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Sem horário de início informado, conta a partir do momento em que o bloco aparece na tela.
  const inicioMs = inicio ? new Date(inicio.replace(" ", "T")).getTime() : (montadoEm ?? NaN);
  const seg = agora && Number.isFinite(inicioMs) ? Math.max(0, Math.floor((agora - inicioMs) / 1000)) : 0;
  const tempo = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

  if (modo === "trechos") {
    const pct = maxPassos > 0 ? Math.round((passos / maxPassos) * 100) : 0;
    return (
      <div className="mb-4" role="status" aria-live="polite">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm">{lendo}</span>
          <span className="text-sm tabular-nums text-muted">{tempo} · {pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel2" aria-hidden>
          <div className="relative h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%` }}>
            <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {passos} de {maxPassos} {maxPassos === 1 ? "trecho lido" : "trechos lidos"}. Porcentagem real: a IA lê, confere a Biblioteca e grava um trecho antes de passar ao próximo.
        </p>
      </div>
    );
  }

  const preparando = /Preparando/i.test(etapa);
  const conferindo = /Conferindo/i.test(etapa);
  const medido = passos > 0;
  const pct = preparando ? 3 : conferindo ? 96 : medido ? Math.min(92, Math.round(5 + (passos / maxPassos) * 87)) : 0;

  return (
    <div className="mb-4" role="status" aria-live="polite">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm">{conferindo ? "Conferindo os achados" : preparando ? "Preparando a cópia filtrada" : lendo || "A IA está lendo o projeto"}</span>
        <span className="text-sm tabular-nums text-muted">{tempo}{medido || conferindo ? ` · ${conferindo ? 96 : pct}%` : ""}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel2" aria-hidden>
        {medido || preparando || conferindo ? (
          <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {medido
          ? `${passos} ${passos === 1 ? "passo feito" : "passos feitos"} (a IA lê, lista e busca nos arquivos, com limite de ${maxPassos}). Porcentagem estimada: o estudo pode terminar antes do limite.`
          : "Esta etapa não informa o andamento em porcentagem. O cronômetro mostra que a leitura continua em andamento."}
      </p>
    </div>
  );
}
