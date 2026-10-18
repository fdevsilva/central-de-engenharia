import { execFile } from "node:child_process";
import { conectar } from "./db";
import { executavel } from "./claude";
import { temChave } from "./medicoes";
import { estadoBibliotecaBase } from "./biblioteca-base";

// Checklist de primeiro acesso: mostra, na ordem, o que falta para a Central funcionar na conta de quem a baixou.
// A verificação do Claude Code lê só se há login. Nada da conta (e-mail, organização) é guardado nem mostrado.

const CHAVE_OCULTO = "primeiros_passos_ocultos";

function executar(cmd: string, args: string[]): Promise<{ ok: boolean; saida: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 8000, windowsHide: true }, (e, out) => resolve({ ok: !e, saida: String(out ?? "") }));
  });
}

let cacheClaude: { quando: number; instalado: boolean; logado: boolean } | null = null;
export async function verificarClaude(): Promise<{ instalado: boolean; logado: boolean }> {
  if (cacheClaude && Date.now() - cacheClaude.quando < 60_000) return cacheClaude;
  const r = await executar(executavel(), ["auth", "status"]);
  let logado = false;
  try {
    logado = (JSON.parse(r.saida) as { loggedIn?: unknown }).loggedIn === true;
  } catch {
    logado = false;
  }
  // Se o comando respondeu algo, o programa existe; sem resposta nenhuma, tratamos como não instalado.
  const instalado = r.ok || r.saida.length > 0;
  cacheClaude = { quando: Date.now(), instalado, logado };
  return cacheClaude;
}

let cacheGit: { quando: number; ok: boolean } | null = null;
async function verificarGit(): Promise<boolean> {
  if (cacheGit && Date.now() - cacheGit.quando < 60_000) return cacheGit.ok;
  const r = await executar("git", ["--version"]);
  cacheGit = { quando: Date.now(), ok: r.ok };
  return r.ok;
}

export type Passo = {
  id: string;
  titulo: string;
  descricao: string;
  feito: boolean;
  obrigatorio: boolean;
  /** Link para a página onde o passo é feito. */
  href?: string;
  rotuloLink?: string;
  /** Passo que se faz com um botão (formulário), em vez de um link. */
  acaoBiblioteca?: boolean;
  /** Ajuda curta, em linhas, para quem não tiver o passo feito. */
  ajuda?: string[];
};

export async function primeirosPassos(): Promise<{ passos: Passo[]; feitos: number; total: number; obrigatoriosFeitos: boolean; oculto: boolean }> {
  const c = conectar();
  const n = (sql: string) => (c.prepare(sql).get() as { n: number }).n;
  const claude = await verificarClaude();
  const git = await verificarGit();
  const base = estadoBibliotecaBase();
  const itens = n("SELECT COUNT(*) AS n FROM solucoes WHERE situacao = 'Incorporada'");

  const passos: Passo[] = [
    {
      id: "claude",
      titulo: "Instalar o Claude Code e entrar na sua conta",
      descricao: "A Central usa o Claude Code do seu computador, com o seu login. É ele que lê o código e escreve os relatórios.",
      feito: claude.instalado && claude.logado,
      obrigatorio: true,
      ajuda: claude.instalado
        ? ["O Claude Code está instalado, mas sem login. Abra um terminal, rode o comando claude e entre com a sua conta.", "Depois, recarregue esta página."]
        : ["Instale o Claude Code pelo instalador oficial (claude.com/claude-code).", "Abra um terminal, rode o comando claude e entre com a sua conta.", "Se ele não for encontrado, defina CLAUDE_BIN no arquivo .env.local com o caminho do programa."],
    },
    {
      id: "biblioteca",
      titulo: "Carregar a Biblioteca base",
      descricao: base.disponivel ? `Instala os ${base.noPacote} itens de engenharia que acompanham a Central, em 13 categorias e 3 níveis.` : "O pacote da Biblioteca não foi encontrado na pasta da Central.",
      feito: itens > 0 && (!base.disponivel || base.carregados >= base.noPacote),
      obrigatorio: true,
      acaoBiblioteca: base.disponivel,
    },
    {
      id: "repositorio",
      titulo: "Adicionar o primeiro repositório",
      descricao: "Cole o link de um repositório público do GitHub ou autorize uma pasta do seu computador. A Central só lê.",
      feito: n("SELECT COUNT(*) AS n FROM pastas_autorizadas WHERE ativa = 1") > 0,
      obrigatorio: true,
      href: "/repositorios",
      rotuloLink: "Ir para Repositórios",
    },
    {
      id: "leitura",
      titulo: "Fazer a primeira leitura",
      descricao: "A IA lê o repositório e aponta as boas práticas que ele já tem. Leva alguns minutos e mostra o andamento.",
      feito: n("SELECT COUNT(*) AS n FROM estudos WHERE estado = 'Concluído'") > 0,
      obrigatorio: true,
      href: "/repositorios",
      rotuloLink: "Estudar um repositório",
    },
    {
      id: "relatorio",
      titulo: "Gerar o primeiro relatório de melhorias",
      descricao: "Compara o repositório com a Biblioteca e entrega o que melhorar, com texto pronto para a sua IA.",
      feito: n("SELECT COUNT(*) AS n FROM relatorios WHERE estado = 'Concluído'") > 0,
      obrigatorio: true,
      href: "/repositorios",
      rotuloLink: "Gerar um relatório",
    },
    {
      id: "git",
      titulo: "Git instalado (para ler repositórios por link)",
      descricao: "Só é necessário para repositórios do GitHub por link. Para pastas do seu computador não precisa.",
      feito: git,
      obrigatorio: false,
      ajuda: ["Instale o Git em git-scm.com e reinicie a Central."],
    },
    {
      id: "pagespeed",
      titulo: "Chave do PageSpeed (opcional)",
      descricao: "Permite medir sites no Google PageSpeed Insights. A chave é gratuita e fica só no seu arquivo .env.local.",
      feito: temChave(),
      obrigatorio: false,
      href: "/pagespeed",
      rotuloLink: "Ver como criar a chave",
    },
  ];

  const obrigatorios = passos.filter((p) => p.obrigatorio);
  const oculto = !!(c.prepare("SELECT valor FROM configuracoes WHERE chave = ?").get(CHAVE_OCULTO) as { valor: string } | undefined);
  return {
    passos,
    feitos: passos.filter((p) => p.feito).length,
    total: passos.length,
    obrigatoriosFeitos: obrigatorios.every((p) => p.feito),
    oculto,
  };
}

export function ocultarPrimeirosPassos(ocultar: boolean) {
  const c = conectar();
  if (ocultar) c.prepare("INSERT INTO configuracoes (chave, valor) VALUES (?, '1') ON CONFLICT(chave) DO UPDATE SET valor = '1'").run(CHAVE_OCULTO);
  else c.prepare("DELETE FROM configuracoes WHERE chave = ?").run(CHAVE_OCULTO);
}
