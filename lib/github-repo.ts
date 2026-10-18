import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

// Leitura de repositórios PÚBLICOS de terceiros. Só github.com, só HTTPS, sem credenciais, e nada do que é baixado é executado.

export type RepoGithub = { dono: string; repo: string; url: string; nome: string };

const NOME_OK = /^[A-Za-z0-9_.-]{1,100}$/;
const TAMANHO_MAXIMO_KB = 300_000;
const TEMPO_CLONE_MS = 180_000;

export function ehLinkGithub(texto: string): boolean {
  return /(^|[\s/@])github\.com[/:]/i.test(texto.trim());
}

// Aceita https://github.com/dono/repo, com ou sem .git e com caminhos extras (/tree/main, /blob/...).
export function lerLinkGithub(entrada: string): RepoGithub {
  const t = entrada.trim().replace(/^git@github\.com:/i, "https://github.com/");
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    throw new Error("Não reconheci o link. Use o endereço do repositório, como https://github.com/dono/repositorio.");
  }
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== "github.com" || u.username || u.password || u.port) {
    throw new Error("Só aceito links de repositórios públicos do github.com, em HTTPS e sem usuário ou senha.");
  }
  const partes = u.pathname.split("/").filter(Boolean);
  if (partes.length < 2) throw new Error("O link precisa ter o dono e o repositório, como github.com/dono/repositorio.");
  const dono = partes[0];
  const repo = partes[1].replace(/\.git$/i, "");
  if (!NOME_OK.test(dono) || !NOME_OK.test(repo) || repo === "." || repo === ".." || dono === "." || dono === "..") throw new Error("O nome do dono ou do repositório tem caracteres que não são aceitos.");
  return { dono, repo, url: `https://github.com/${dono}/${repo}`, nome: `${dono}/${repo}` };
}

// Confere, pela API pública, se o repositório existe, é público e tem um tamanho razoável.
export async function conferirRepositorioPublico(r: RepoGithub): Promise<{ tamanhoKB: number; ramo: string; arquivado: boolean; licenca: string }> {
  let resp: Response;
  try {
    resp = await fetch(`https://api.github.com/repos/${r.dono}/${r.repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "central-de-engenharia" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new Error("Não foi possível falar com o GitHub agora. Tente de novo em instantes.");
  }
  if (resp.status === 404) throw new Error("Repositório não encontrado ou privado. Só repositórios públicos podem ser lidos por link.");
  if (resp.status === 403 || resp.status === 429) throw new Error("O GitHub limitou as consultas por agora. Aguarde alguns minutos e tente de novo.");
  if (!resp.ok) throw new Error(`O GitHub respondeu com erro ${resp.status}.`);
  const d = (await resp.json()) as { private?: boolean; size?: number; default_branch?: string; archived?: boolean; license?: { spdx_id?: string } | null };
  if (d.private) throw new Error("Este repositório é privado. Só repositórios públicos podem ser lidos por link.");
  const tamanhoKB = Number(d.size ?? 0);
  if (tamanhoKB > TAMANHO_MAXIMO_KB) throw new Error(`O repositório é grande demais (${Math.round(tamanhoKB / 1024)} MB). O limite é ${Math.round(TAMANHO_MAXIMO_KB / 1024)} MB.`);
  return { tamanhoKB, ramo: d.default_branch ?? "", arquivado: !!d.archived, licenca: d.license?.spdx_id ?? "" };
}

// Baixa só a versão atual, sem histórico e sem credenciais. Nada do que vem no repositório é executado:
// sem ganchos (hooks), sem submódulos, sem LFS e sem atalhos simbólicos.
export function baixarRepositorio(r: RepoGithub, destino: string): Promise<void> {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(path.dirname(destino), { recursive: true });
  const args = [
    "-c", "credential.helper=",
    "-c", "core.symlinks=false",
    "-c", `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
    "-c", "protocol.allow=never",
    "-c", "protocol.https.allow=always",
    "clone", "--depth", "1", "--single-branch", "--no-tags", "--no-recurse-submodules", "--template=",
    r.url, destino,
  ];
  return new Promise((resolve, reject) => {
    const filho = spawn("git", args, {
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1", GIT_ASKPASS: "echo", GIT_CONFIG_NOSYSTEM: "1" },
    });
    let erro = "";
    filho.stderr.on("data", (b) => (erro += b.toString("utf8")));
    const relogio = setTimeout(() => {
      filho.kill();
      reject(new Error("O download do repositório demorou demais e foi cancelado."));
    }, TEMPO_CLONE_MS);
    filho.on("error", () => {
      clearTimeout(relogio);
      reject(new Error("Não foi possível iniciar o Git. Confirme se ele está instalado."));
    });
    filho.on("close", (codigo) => {
      clearTimeout(relogio);
      if (codigo === 0) resolve();
      else {
        console.error("Falha ao baixar repositório:", erro.slice(0, 300));
        reject(new Error("Não foi possível baixar o repositório. Confirme se o link está certo e se ele é público."));
      }
    });
  });
}

export function removerBaixado(destino: string) {
  try {
    rmSync(destino, { recursive: true, force: true });
  } catch {
    /* se ficar algum resto, a próxima leitura apaga antes de baixar */
  }
}
