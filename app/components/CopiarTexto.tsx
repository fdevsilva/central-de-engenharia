"use client";

import { useState } from "react";

// Copia um texto (por exemplo, o bloco para colar na IA do desenvolvimento).
export default function CopiarTexto({ texto, rotulo = "Copiar para colar na IA" }: { texto: string; rotulo?: string }) {
  const [estado, setEstado] = useState<"" | "copiado" | "erro">("");
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
      setTimeout(() => setEstado(""), 3000);
    } catch {
      setEstado("erro");
    }
  }
  return (
    <button type="button" onClick={copiar} className="rounded-md border border-line px-3 py-1.5 text-xs hover:border-accent">
      {estado === "copiado" ? "Copiado" : estado === "erro" ? "Não foi possível copiar" : rotulo}
    </button>
  );
}
