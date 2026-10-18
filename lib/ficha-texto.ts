import { NIVEIS, SIGNIFICADO_NIVEL, type FichaIA, type Nivel } from "./solucoes";
import { contemSegredoReal } from "./segredos";

// Regras da ficha completa, usadas nos prompts de enriquecimento, estudo e chat da Biblioteca.
export const CAMPOS_FICHA = `Cada item precisa de uma ficha completa, escrita para quem abre o item e quer entender de verdade o que aquela prática traz:
- "resumo": a definição em uma frase (até 500 caracteres), no formato "Nome da prática (termo técnico, se houver): regra objetiva e o resultado que ela garante". Exemplo de tom: "Validação e sanitização estrita no backend (Zero-Trust Input): toda entrada é validada por schemas de runtime baseados em whitelist; o frontend serve só para UX e o backend é inegociável."
- "pilar": o domínio técnico em até 120 caracteres, por exemplo "Autenticação, identidade e gestão de acessos (IAM) / Zero Trust".
- "dentro": o que tem dentro da prática, em 1 a 2 frases (até 400 caracteres): o que é feito, onde e com o quê.
- "porque": por que a prática existe, em 2 a 3 frases (até 600 caracteres): o ataque, a falha ou o prejuízo concreto que ela evita.
- "tecnica": a técnica na prática, em 1 a 3 frases (até 600 caracteres): como se implementa, podendo citar bibliotecas, ferramentas ou padrões comuns como exemplo.
- "conceitos": de 1 a 5 conceitos que o leitor precisa entender nessa prática, cada um {"nome":"Nome do conceito (termo técnico)","significa":"O que significa e por que importa, em 2 a 4 frases"}. Itens simples têm 1 ou 2 conceitos. Não encha linguiça: cada conceito precisa acrescentar algo que os outros campos não disseram.
- "nivel": BASE, SÊNIOR ou STAFF, decidido por você. Deixe vazio só se o item for conhecimento ou procedimento que não é um requisito exigível. Definições do usuário: ${NIVEIS.map((n) => `${n} = ${SIGNIFICADO_NIVEL[n]}`).join(" ")}
- "justificativa_nivel": 2 a 4 frases explicando por que esse nível e não outro, apontando o que torna a prática mais ou menos avançada.
Regras da ficha: baseie-a na descrição da fonte. Conhecimento geral de engenharia é permitido para EXPLICAR termos e padrões (por exemplo RLS, aal2, Argon2, Zod), mas não acrescente fatos sobre o projeto de origem que a descrição não traga. Não escreva números fixos, parâmetros de custo nem versões de bibliotecas; diga que se deve consultar a documentação atual da biblioteca. Cite uma norma, RFC ou padrão (por exemplo NIST, OWASP, RFC 7807) somente se tiver certeza de que ele trata exatamente do assunto, senão não cite. Sem travessão longo.
Nos textos que escrever, chame os níveis de Júnior, Sênior e Staff (nunca "BASE", "Básico" ou "SENIOR"). O código "BASE" do campo "nivel" corresponde ao nível Júnior.
Calibragem do nível: práticas que arquitetam o sistema para resistir mesmo se outras camadas falharem (defesa em profundidade, verificação no menor nível, negação por padrão no próprio banco) são STAFF. O usuário classificou assim: "RLS forçado, revogação total de privilégios de anon e authenticated e acesso só por funções do schema de API" é STAFF (arquitetura de banco defensiva); "checagem do claim aal2 do segundo fator direto no Postgres" é STAFF (identidade e asserção crítica no banco). Práticas que todo sistema em produção precisa (hash de senha, HTTPS, validação no backend) são BASE. Práticas que separam o funcionando do correto (CSRF, limites de requisição, cabeçalhos de segurança) são SÊNIOR.`;

export const FORMATO_CAMPOS_FICHA = `"resumo":"","pilar":"","dentro":"","porque":"","tecnica":"","conceitos":[{"nome":"","significa":""}],"nivel":"","justificativa_nivel":""`;

export type FichaLida = FichaIA;

// Prefixos fixos: a página do item reconhece cada parte da ficha por eles.
export const ROTULO_DENTRO = "O que tem dentro: ";
export const ROTULO_PORQUE = "Por que existe: ";
export const ROTULO_TECNICA = "Técnica: ";

export type ConteudoFicha = { dentro: string; porque: string; tecnica: string; conceitos: { nome: string; significa: string }[] };

// Separa o texto gravado em `explicacao` nas partes da ficha. Texto no formato antigo cai em `outros`.
export function lerConteudo(explicacao: string): ConteudoFicha & { outros: string[] } {
  const r: ConteudoFicha & { outros: string[] } = { dentro: "", porque: "", tecnica: "", conceitos: [], outros: [] };
  for (const linha of explicacao.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (linha.startsWith(ROTULO_DENTRO)) r.dentro = linha.slice(ROTULO_DENTRO.length);
    else if (linha.startsWith(ROTULO_PORQUE)) r.porque = linha.slice(ROTULO_PORQUE.length);
    else if (linha.startsWith(ROTULO_TECNICA)) r.tecnica = linha.slice(ROTULO_TECNICA.length);
    else {
      const m = linha.match(/^\d+\.\s+(.+?)\s*::\s*(.+)$/);
      if (m) r.conceitos.push({ nome: m[1], significa: m[2] });
      else r.outros.push(linha);
    }
  }
  return r;
}

export function temFichaNova(explicacao: string): boolean {
  return explicacao.includes(`\n${ROTULO_PORQUE}`) || explicacao.startsWith(ROTULO_PORQUE);
}

// Lê os campos da ficha de um objeto devolvido pela IA. Devolve null se a ficha estiver ausente, incompleta ou suspeita.
export function lerCamposFicha(o: Record<string, unknown>): { ficha: FichaIA | null; problema: string } {
  const txt = (x: unknown) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "");
  const resumo = txt(o.resumo), pilar = txt(o.pilar), just = txt(o.justificativa_nivel);
  const dentro = txt(o.dentro), porque = txt(o.porque), tecnica = txt(o.tecnica);
  const conceitos = (Array.isArray(o.conceitos) ? o.conceitos : [])
    .map((c) => {
      const x = (c ?? {}) as Record<string, unknown>;
      return { nome: txt(x.nome).replace(/::/g, ":"), significa: txt(x.significa).replace(/::/g, ":") };
    })
    .filter((c) => c.nome && c.significa)
    .slice(0, 5);
  if (!resumo || !pilar || !dentro || !porque || !tecnica || conceitos.length === 0) return { ficha: null, problema: "ficha ausente ou incompleta" };
  if (resumo.length > 600 || pilar.length > 140 || dentro.length > 500 || porque.length > 800 || tecnica.length > 800 || just.length > 1000 || conceitos.some((c) => c.nome.length > 140 || c.significa.length > 900))
    return { ficha: null, problema: "ficha longa demais" };
  if ([resumo, pilar, dentro, porque, tecnica, just, ...conceitos.flatMap((c) => [c.nome, c.significa])].some(contemSegredoReal)) return { ficha: null, problema: "ficha parecia conter segredo" };
  const n = txt(o.nivel).toUpperCase().replace("SENIOR", "SÊNIOR");
  const nivel: Nivel | null = (NIVEIS as string[]).includes(n) ? (n as Nivel) : null;
  if (nivel && !just) return { ficha: null, problema: "nível sem justificativa" };
  const explicacao = [`${ROTULO_DENTRO}${dentro}`, `${ROTULO_PORQUE}${porque}`, `${ROTULO_TECNICA}${tecnica}`, ...conceitos.map((c, i) => `${i + 1}. ${c.nome} :: ${c.significa}`)].join("\n");
  return { ficha: { resumo, pilar, nivel, justificativaNivel: just, explicacao }, problema: "" };
}
