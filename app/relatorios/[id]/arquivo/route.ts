import { obterRelatorio } from "../../../../lib/relatorio";
import { obterPasta } from "../../../../lib/estudo";

// Baixa o relatório em Markdown (.md): abre em qualquer editor e pode ser colado numa IA.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rel = Number.isInteger(Number(id)) ? obterRelatorio(Number(id)) : undefined;
  if (!rel || rel.estado !== "Concluído" || !rel.markdown) return new Response("Relatório não encontrado ou ainda não concluído.", { status: 404 });
  const pasta = obterPasta(rel.pasta_id);
  const nome = (pasta?.nome ?? "repositorio").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "repositorio";
  const data = (rel.concluido_em ?? rel.iniciado_em).slice(0, 10);
  return new Response(rel.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${nome}-${data}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
