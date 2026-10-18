import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

// Estado da conexão com o GitHub, só para exibir em Configurações. Nunca lê nem mostra o token.
export type EstadoGithub = { logado: boolean; conta: string; repositorio: string; erro: string };

const CAMINHOS_GH = ["C:\\Program Files\\GitHub CLI\\gh.exe", "C:\\Program Files (x86)\\GitHub CLI\\gh.exe"];

function executar(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 8000, windowsHide: true, cwd: process.cwd() }, (e, out) => (e ? reject(e) : resolve(String(out))));
  });
}

export async function estadoGithub(): Promise<EstadoGithub> {
  const r: EstadoGithub = { logado: false, conta: "", repositorio: "", erro: "" };
  try {
    const url = (await executar("git", ["remote", "get-url", "origin"])).trim();
    const m = url.match(/github\.com[/:]([^/\s]+\/[^/\s]+?)(?:\.git)?$/);
    r.repositorio = m ? m[1] : "";
  } catch {
    /* sem repositório remoto configurado */
  }
  const gh = process.env.GH_BIN || CAMINHOS_GH.find((c) => existsSync(c)) || "gh";
  try {
    // O login é lido do cofre do sistema pela própria ferramenta; o token não passa por aqui.
    const nome = (await executar(gh, ["api", "user", "--jq", ".login"])).trim();
    r.logado = nome.length > 0;
    r.conta = nome;
  } catch {
    r.erro = "A ferramenta gh não está instalada, não está logada ou não respondeu.";
  }
  return r;
}
