import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export type RespostaClaude = {
  texto: string;
  sessionId: string;
  custo: number | null;
  limite5h: number | null;
  limite7d: number | null;
};

// Modelo leve por padrão, para economizar o limite do plano durante os testes.
const MODELO = process.env.CENTRAL_MODELO || "haiku";
const TEMPO_MAXIMO_MS = 180_000;

// Onde está o Claude Code: a variável CLAUDE_BIN, a pasta padrão do instalador oficial ou o que estiver no PATH.
export function executavel(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const padrao = path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude");
  return existsSync(padrao) ? padrao : "claude";
}

// Pasta vazia e isolada: enquanto nenhum projeto estiver autorizado, o Claude Code não enxerga nada do computador.
function pastaIsolada(): string {
  const dir = path.join(process.cwd(), "data", "sandbox");
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Pasta de trabalho FORA de qualquer repositório. Dentro de um repositório, o Claude Code lê o estado do Git, o AGENTS.md e a
// memória do projeto e passa a se comportar como o agente de programação daquele código, em vez de conversar.
export function pastaExterna(): string {
  const dir = path.join(os.tmpdir(), "central-chat");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export type OpcoesClaude = {
  // Troca o prompt padrão do Claude Code (de agente de programação) pelo das instruções, em vez de somar a ele.
  substituirSistema?: boolean;
  // Recebe cada trecho de texto assim que a IA o escreve (para mostrar a resposta aparecendo).
  aoTexto?: (trecho: string) => void;
  semSessao?: boolean;
  // Padrão: nenhuma ferramenta. Para estudar uma pasta, só ferramentas de leitura (ex.: "Read,Glob,Grep").
  ferramentas?: string;
  // Padrão: pasta vazia e isolada. Para estudar, a cópia filtrada do projeto.
  cwd?: string;
  modelo?: string;
  maxPassos?: number;
  tempoMaximoMs?: number;
  // Recebe cada evento do Claude Code enquanto ele trabalha (por exemplo, para mostrar o andamento).
  aoEvento?: (evento: Record<string, unknown>) => void;
};

const SO_LEITURA = new Set(["Read", "Glob", "Grep"]);

export function perguntar(
  mensagem: string,
  sessionId?: string,
  instrucoes?: string,
  opcoes: OpcoesClaude = {},
): Promise<RespostaClaude> {
  const ferramentas = opcoes.ferramentas ?? "";
  // Trava de segurança: a Central nunca libera ferramenta que escreva, execute ou acesse a rede.
  if (ferramentas.split(",").map((f) => f.trim()).filter(Boolean).some((f) => !SO_LEITURA.has(f))) {
    return Promise.reject(new Error("Só ferramentas de leitura podem ser liberadas."));
  }
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    // Sem ferramentas não há nada a proteger, e o modo "plan" faz a IA agir como quem planeja código (chama agentes, escreve "plano").
    // Com ferramentas de leitura (estudo de repositório) o modo "plan" continua como trava extra.
    ferramentas ? "plan" : "default",
    "--model",
    opcoes.modelo ?? MODELO,
    "--tools",
    ferramentas,
    "--strict-mcp-config",
    "--disable-slash-commands",
  ];
  if (opcoes.maxPassos) args.push("--max-turns", String(opcoes.maxPassos));
  if (opcoes.semSessao) args.push("--no-session-persistence");
  if (opcoes.aoTexto) args.push("--include-partial-messages");
  if (instrucoes) args.push(opcoes.substituirSistema ? "--system-prompt" : "--append-system-prompt", instrucoes);
  if (sessionId) args.push("--resume", sessionId);

  return new Promise((resolve, reject) => {
    const filho = spawn(executavel(), args, { cwd: opcoes.cwd ?? pastaIsolada(), windowsHide: true });
    let saida = "";
    let erro = "";
    const relogio = setTimeout(() => {
      filho.kill();
      reject(new Error("Tempo esgotado ao aguardar o Claude Code."));
    }, opcoes.tempoMaximoMs ?? TEMPO_MAXIMO_MS);

    let resto = "";
    filho.stdout.on("data", (b) => {
      const pedaco = b.toString("utf8");
      saida += pedaco;
      if (!opcoes.aoEvento && !opcoes.aoTexto) return;
      resto += pedaco;
      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";
      for (const l of linhas) {
        try {
          const ev = JSON.parse(l) as Record<string, unknown>;
          opcoes.aoEvento?.(ev);
          if (opcoes.aoTexto && ev.type === "stream_event") {
            const e2 = ev.event as { type?: string; delta?: { type?: string; text?: string } } | undefined;
            if (e2?.type === "content_block_delta" && e2.delta?.type === "text_delta" && e2.delta.text) opcoes.aoTexto(e2.delta.text);
          }
        } catch {
          // linha incompleta ou que não é JSON: ignorar
        }
      }
    });
    filho.stderr.on("data", (b) => (erro += b.toString("utf8")));
    filho.on("error", () => {
      clearTimeout(relogio);
      reject(new Error("Não foi possível iniciar o Claude Code."));
    });
    filho.on("close", () => {
      clearTimeout(relogio);
      let texto = "";
      let id = sessionId ?? "";
      let custo: number | null = null;
      let l5: number | null = null;
      let l7: number | null = null;
      let falhou = false;
      for (const linha of saida.split("\n")) {
        if (!linha.trim()) continue;
        try {
          const e = JSON.parse(linha);
          if (e.type === "result") {
            if (typeof e.result === "string") texto = e.result;
            if (e.session_id) id = e.session_id;
            if (typeof e.total_cost_usd === "number") custo = e.total_cost_usd;
            if (e.is_error) falhou = true;
          } else if (e.type === "rate_limit_event") {
            const j = e.rate_limit_info?.unifiedWindows;
            if (typeof j?.five_hour?.utilization === "number") l5 = j.five_hour.utilization;
            if (typeof j?.seven_day?.utilization === "number") l7 = j.seven_day.utilization;
          }
        } catch {
          // linha que não é JSON: ignorar
        }
      }
      if (falhou || !texto || !id) {
        // Detalhe técnico fica só no servidor, nunca vai para a tela.
        console.error("Falha no Claude Code:", erro.slice(0, 500));
        reject(new Error("O Claude Code não devolveu uma resposta válida."));
        return;
      }
      resolve({ texto, sessionId: id, custo, limite5h: l5, limite7d: l7 });
    });

    filho.stdin.end(mensagem, "utf8");
  });
}
