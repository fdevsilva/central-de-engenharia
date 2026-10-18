// As 13 categorias da Biblioteca de Engenharia, definidas pelo usuário. Fixas desde o início.

export type Categoria = { slug: string; nome: string; resumo: string; escopo: string };

export const CATEGORIAS: Categoria[] = [
  {
    slug: "seguranca",
    nome: "Segurança",
    resumo: "Proteção de aplicações, dados e usuários.",
    escopo:
      "Autenticação, autorização, sessões, permissões, isolamento entre clientes, proteção contra ataques, gestão de segredos, auditoria, cópias de segurança e recuperação.",
  },
  {
    slug: "desempenho-seo",
    nome: "Desempenho e SEO",
    resumo: "Velocidade, descoberta e experiência de acesso.",
    escopo:
      "Core Web Vitals, Lighthouse, carregamento, renderização, indexação, metadados, dados estruturados, sitemap e rastreamento pelos mecanismos de busca.",
  },
  {
    slug: "padroes-arquitetura",
    nome: "Padrões e arquitetura",
    resumo: "Como estruturar sistemas sustentáveis.",
    escopo:
      "Organização de código, separação de responsabilidades, componentes reutilizáveis, APIs, padrões de projeto, sistemas multiempresa, modularidade e decisões arquiteturais.",
  },
  {
    slug: "motor-imagens",
    nome: "Motor de imagens",
    resumo: "Tratamento e entrega eficiente de imagens.",
    escopo:
      "Conversão de formatos, WebP e AVIF, redimensionamento, compressão, tamanhos responsivos, carregamento sob demanda, armazenamento e otimização automática.",
  },
  {
    slug: "testes-qualidade",
    nome: "Testes e qualidade",
    resumo: "Como comprovar que uma solução funciona.",
    escopo:
      "Testes unitários, integração, ponta a ponta, regressão, isolamento de dados, acessibilidade, validação de correções e critérios objetivos de aprovação.",
  },
  {
    slug: "banco-dados",
    nome: "Banco de dados e integridade",
    resumo: "Dados corretos, consistentes e recuperáveis.",
    escopo:
      "Modelagem, relacionamentos, índices, consultas, migrações, transações, integridade referencial, políticas de acesso, cópias de segurança e recuperação.",
  },
  {
    slug: "integracoes-apis",
    nome: "Integrações e APIs",
    resumo: "Comunicação confiável entre sistemas.",
    escopo:
      "APIs externas, webhooks, pagamentos, e-mail, autenticação de terceiros, limites de requisição, repetição segura de operações e tratamento de falhas.",
  },
  {
    slug: "implantacao-automacao",
    nome: "Implantação e automação",
    resumo: "Da máquina local ao ambiente publicado.",
    escopo:
      "Git, ramificações, integração contínua, implantação contínua, prévias, variáveis de ambiente, migrações, reversão e verificações antes da publicação.",
  },
  {
    slug: "interface-acessibilidade",
    nome: "Interface e acessibilidade",
    resumo: "Interfaces consistentes, claras e utilizáveis.",
    escopo:
      "Responsividade, navegação por teclado, contraste, leitores de tela, formulários, estados de carregamento, mensagens de erro e consistência visual.",
  },
  {
    slug: "monitoramento-confiabilidade",
    nome: "Monitoramento e confiabilidade",
    resumo: "Descobrir problemas e manter o sistema funcionando.",
    escopo:
      "Registros de eventos, rastreamento de erros, alertas, disponibilidade, limites de recursos, degradação controlada e diagnóstico em produção.",
  },
  {
    slug: "ia-automacao-engenharia",
    nome: "Inteligência artificial e automação de engenharia",
    resumo: "Uso controlado de agentes e ferramentas inteligentes.",
    escopo:
      "Claude Code, instruções de projeto, contexto persistente, análise de repositórios, automação de tarefas, revisão de alterações e limites de execução.",
  },
  {
    slug: "procedimentos-diagnostico",
    nome: "Procedimentos e diagnóstico",
    resumo: "Métodos comprovados para investigar e resolver problemas.",
    escopo:
      "Roteiros de diagnóstico, análise de causa raiz, investigação de lentidão, correção de erros, auditorias técnicas, procedimentos de manutenção e listas de verificação.",
  },
  {
    slug: "documentacao-conhecimento",
    nome: "Documentação e gestão do conhecimento",
    resumo: "Preservar decisões e tornar o conhecimento reutilizável.",
    escopo:
      "Dossiês técnicos, histórico de decisões, padrões aprovados, evidências, controle de versões, rastreabilidade e identificação de informações conflitantes ou desatualizadas.",
  },
];

export const SLUGS = CATEGORIAS.map((c) => c.slug);

export function categoriaPorSlug(slug: string): Categoria | undefined {
  return CATEGORIAS.find((c) => c.slug === slug);
}

export function nomeCategoria(slug: string): string {
  return categoriaPorSlug(slug)?.nome ?? "Sem sugestão";
}

export const TIPOS_SOLUCAO = ["Procedimento", "Código", "Padrão", "Conhecimento", "Checklist"] as const;

export const ESTADOS_VALIDACAO = [
  "Recebido",
  "Analisado",
  "Experimental",
  "Validado em testes",
  "Validado em produção",
  "Desatualizado",
  "Conflitante",
] as const;

// Estados que só podem existir com ao menos uma evidência registrada.
export const ESTADOS_COM_EVIDENCIA: readonly string[] = ["Validado em testes", "Validado em produção"];
