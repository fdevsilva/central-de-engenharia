"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Enquanto o estudo roda em segundo plano, a tela se atualiza sozinha.
export default function AtualizarSozinho({ ativo }: { ativo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [ativo, router]);
  return null;
}
