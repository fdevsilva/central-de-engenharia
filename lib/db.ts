import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type Projeto = {
  id: number;
  slug: string;
  nome: string;
  tipo: string;
  status: string;
  descricao: string;
  repositorio: string;
  criado_em: string;
};

export type Tarefa = {
  id: number;
  projeto_id: number;
  pedido: string;
  nivel: number;
  estado: "Planejada" | "Executada" | "Validada";
  evidencia: string;
  criado_em: string;
};

export type Registro = { id: number; projeto_id: number | null; texto: string; criado_em: string };

let db: DatabaseSync | null = null;

export function conectar(): DatabaseSync {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, "central.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS projetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Ativo',
      descricao TEXT NOT NULL DEFAULT '',
      repositorio TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS tarefas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      pedido TEXT NOT NULL,
      nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel IN (1,2,3)),
      estado TEXT NOT NULL DEFAULT 'Planejada' CHECK (estado IN ('Planejada','Executada','Validada')),
      evidencia TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      CHECK (estado <> 'Validada' OR evidencia <> '')
    );
    CREATE TABLE IF NOT EXISTS historico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER REFERENCES projetos(id),
      texto TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS reunioes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      titulo TEXT NOT NULL CHECK (titulo <> ''),
      claude_session_id TEXT,
      iniciada_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      encerrada_em TEXT
    );
    CREATE TABLE IF NOT EXISTS mensagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reuniao_id INTEGER NOT NULL REFERENCES reunioes(id),
      papel TEXT NOT NULL CHECK (papel IN ('usuario','claude','sistema')),
      texto TEXT NOT NULL,
      custo_usd REAL,
      limite_5h REAL,
      limite_7d REAL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS anotacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      secao INTEGER NOT NULL CHECK (secao BETWEEN 1 AND 14),
      tipo TEXT NOT NULL CHECK (tipo IN
        ('Decisão','Requisito','Fato','Hipótese','Pendência','Descartado','Regra','Proposta','Resolução')),
      texto TEXT NOT NULL CHECK (texto <> ''),
      fonte TEXT NOT NULL CHECK (fonte IN ('Reunião','Manual')),
      reuniao_id INTEGER REFERENCES reunioes(id),
      corrige_id INTEGER REFERENCES anotacoes(id),
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TRIGGER IF NOT EXISTS anotacoes_sem_edicao BEFORE UPDATE ON anotacoes
      BEGIN SELECT RAISE(ABORT, 'anotacoes sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS anotacoes_sem_exclusao BEFORE DELETE ON anotacoes
      BEGIN SELECT RAISE(ABORT, 'anotacoes sao somente de acrescimo'); END;
    CREATE TABLE IF NOT EXISTS materiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      hash TEXT NOT NULL UNIQUE,
      tamanho INTEGER NOT NULL,
      extensao TEXT NOT NULL,
      caminho TEXT NOT NULL,
      versao INTEGER NOT NULL DEFAULT 1,
      estado TEXT NOT NULL DEFAULT 'Recebido' CHECK (estado IN
        ('Recebido','Analisado','Validado em testes','Validado em produção','Experimental','Desatualizado','Conflitante')),
      observacao TEXT NOT NULL DEFAULT '',
      recebido_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS analises (
      material_id INTEGER PRIMARY KEY REFERENCES materiais(id),
      linhas INTEGER NOT NULL,
      palavras INTEGER NOT NULL,
      categoria TEXT NOT NULL,
      topicos TEXT NOT NULL DEFAULT '[]',
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS dossies (
      projeto_id INTEGER PRIMARY KEY REFERENCES projetos(id),
      valores TEXT NOT NULL,
      origens TEXT NOT NULL DEFAULT '{}',
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS dossie_versoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      valores TEXT NOT NULL,
      origens TEXT NOT NULL DEFAULT '{}',
      motivo TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TRIGGER IF NOT EXISTS dossie_versoes_sem_edicao BEFORE UPDATE ON dossie_versoes
      BEGIN SELECT RAISE(ABORT, 'versoes do dossie sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS dossie_versoes_sem_exclusao BEFORE DELETE ON dossie_versoes
      BEGIN SELECT RAISE(ABORT, 'versoes do dossie sao somente de acrescimo'); END;
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS solucoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL CHECK (titulo <> ''),
      tipo TEXT NOT NULL CHECK (tipo IN ('Procedimento','Código','Padrão','Conhecimento','Checklist')),
      descricao TEXT NOT NULL DEFAULT '',
      origem TEXT NOT NULL CHECK (origem <> ''),
      material_id INTEGER REFERENCES materiais(id),
      estado TEXT NOT NULL DEFAULT 'Recebido' CHECK (estado IN
        ('Recebido','Analisado','Experimental','Validado em testes','Validado em produção','Desatualizado','Conflitante')),
      limitacoes TEXT NOT NULL DEFAULT '',
      situacao TEXT NOT NULL DEFAULT 'Proposta' CHECK (situacao IN ('Proposta','Incorporada','Rejeitada')),
      nivel TEXT CHECK (nivel IS NULL OR nivel IN ('BASE','SÊNIOR','STAFF')),
      chave_origem TEXT UNIQUE,
      resumo TEXT NOT NULL DEFAULT '',
      pilar TEXT NOT NULL DEFAULT '',
      explicacao TEXT NOT NULL DEFAULT '',
      justificativa_nivel TEXT NOT NULL DEFAULT '',
      nivel_por TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS perfis_projeto (
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      categoria TEXT NOT NULL,
      nivel TEXT NOT NULL CHECK (nivel IN ('Nenhum','BASE','SÊNIOR','STAFF')),
      anotacao_id INTEGER,
      PRIMARY KEY (projeto_id, categoria)
    );
    CREATE TABLE IF NOT EXISTS requisitos_projeto (
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      solucao_id INTEGER NOT NULL REFERENCES solucoes(id),
      aplicabilidade TEXT NOT NULL DEFAULT 'Obrigatório' CHECK (aplicabilidade IN ('Obrigatório','Recomendado','Não aplicável')),
      justificativa TEXT NOT NULL DEFAULT '',
      atendido INTEGER NOT NULL DEFAULT 0 CHECK (atendido IN (0,1)),
      evidencia TEXT NOT NULL DEFAULT '',
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (projeto_id, solucao_id),
      CHECK (aplicabilidade <> 'Não aplicável' OR justificativa <> ''),
      CHECK (atendido = 0 OR evidencia <> '')
    );
    CREATE TABLE IF NOT EXISTS solucao_categorias (
      solucao_id INTEGER NOT NULL REFERENCES solucoes(id),
      categoria TEXT NOT NULL,
      principal INTEGER NOT NULL DEFAULT 0 CHECK (principal IN (0,1)),
      PRIMARY KEY (solucao_id, categoria)
    );
    CREATE TABLE IF NOT EXISTS evidencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solucao_id INTEGER NOT NULL REFERENCES solucoes(id),
      descricao TEXT NOT NULL CHECK (descricao <> ''),
      referencia TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TRIGGER IF NOT EXISTS evidencias_sem_edicao BEFORE UPDATE ON evidencias
      BEGIN SELECT RAISE(ABORT, 'evidencias sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS evidencias_sem_exclusao BEFORE DELETE ON evidencias
      BEGIN SELECT RAISE(ABORT, 'evidencias sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS validacao_exige_evidencia_ins BEFORE INSERT ON solucoes
      WHEN NEW.estado IN ('Validado em testes','Validado em produção')
      BEGIN SELECT RAISE(ABORT, 'validacao exige evidencia'); END;
    CREATE TRIGGER IF NOT EXISTS validacao_exige_evidencia_upd BEFORE UPDATE OF estado ON solucoes
      WHEN NEW.estado IN ('Validado em testes','Validado em produção')
        AND (SELECT COUNT(*) FROM evidencias WHERE solucao_id = NEW.id) = 0
      BEGIN SELECT RAISE(ABORT, 'validacao exige evidencia'); END;
    CREATE TABLE IF NOT EXISTS aprovacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      origem TEXT NOT NULL DEFAULT '',
      solucao_id INTEGER REFERENCES solucoes(id),
      estado TEXT NOT NULL DEFAULT 'Pendente' CHECK (estado IN ('Pendente','Aprovada','Rejeitada')),
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      decidido_em TEXT
    );
    CREATE TABLE IF NOT EXISTS incorporacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solucao_id INTEGER NOT NULL REFERENCES solucoes(id),
      aprovacao_id INTEGER NOT NULL REFERENCES aprovacoes(id),
      registrado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TRIGGER IF NOT EXISTS incorporacoes_sem_edicao BEFORE UPDATE ON incorporacoes
      BEGIN SELECT RAISE(ABORT, 'incorporacoes sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS incorporacoes_sem_exclusao BEFORE DELETE ON incorporacoes
      BEGIN SELECT RAISE(ABORT, 'incorporacoes sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS historico_sem_edicao BEFORE UPDATE ON historico
      BEGIN SELECT RAISE(ABORT, 'historico e somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS historico_sem_exclusao BEFORE DELETE ON historico
      BEGIN SELECT RAISE(ABORT, 'historico e somente de acrescimo'); END;
    CREATE TABLE IF NOT EXISTS medicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      ferramenta TEXT NOT NULL,
      url TEXT NOT NULL,
      dispositivo TEXT NOT NULL CHECK (dispositivo IN ('mobile','desktop')),
      pagina TEXT NOT NULL,
      rotulo TEXT NOT NULL,
      repeticoes INTEGER NOT NULL DEFAULT 1 CHECK (repeticoes BETWEEN 1 AND 5),
      medido_em TEXT NOT NULL,
      nota_desempenho INTEGER NOT NULL CHECK (nota_desempenho BETWEEN 0 AND 100),
      nota_acessibilidade INTEGER NOT NULL CHECK (nota_acessibilidade BETWEEN 0 AND 100),
      nota_boas_praticas INTEGER NOT NULL CHECK (nota_boas_praticas BETWEEN 0 AND 100),
      nota_seo INTEGER NOT NULL CHECK (nota_seo BETWEEN 0 AND 100),
      lcp_s REAL NOT NULL, fcp_s REAL NOT NULL, tbt_ms REAL NOT NULL, cls REAL NOT NULL, speed_index_s REAL NOT NULL,
      detalhes TEXT NOT NULL DEFAULT '{}',
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TRIGGER IF NOT EXISTS medicoes_sem_edicao BEFORE UPDATE ON medicoes
      BEGIN SELECT RAISE(ABORT, 'medicoes sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS medicoes_sem_exclusao BEFORE DELETE ON medicoes
      BEGIN SELECT RAISE(ABORT, 'medicoes sao somente de acrescimo'); END;
    CREATE TABLE IF NOT EXISTS pastas_autorizadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caminho TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      modo TEXT NOT NULL DEFAULT 'leitura' CHECK (modo = 'leitura'),
      ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0,1)),
      autorizada_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS estudos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pasta_id INTEGER NOT NULL REFERENCES pastas_autorizadas(id),
      estado TEXT NOT NULL DEFAULT 'Em andamento' CHECK (estado IN ('Em andamento','Concluído','Falhou')),
      modelo TEXT NOT NULL,
      etapa TEXT NOT NULL DEFAULT 'Preparando a cópia filtrada',
      copiados INTEGER NOT NULL DEFAULT 0,
      ignorados TEXT NOT NULL DEFAULT '[]',
      resumo TEXT NOT NULL DEFAULT '',
      achados INTEGER NOT NULL DEFAULT 0,
      descartes TEXT NOT NULL DEFAULT '[]',
      erro TEXT NOT NULL DEFAULT '',
      custo_usd REAL,
      iniciado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      concluido_em TEXT
    );
    CREATE TABLE IF NOT EXISTS relatorios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pasta_id INTEGER NOT NULL REFERENCES pastas_autorizadas(id),
      estado TEXT NOT NULL DEFAULT 'Em andamento' CHECK (estado IN ('Em andamento','Concluído','Falhou')),
      nivel TEXT NOT NULL CHECK (nivel IN ('BASE','SÊNIOR','STAFF')),
      categorias TEXT NOT NULL DEFAULT '[]',
      etapa TEXT NOT NULL DEFAULT '',
      grupos_total INTEGER NOT NULL DEFAULT 0,
      grupos_feitos INTEGER NOT NULL DEFAULT 0,
      custo_usd REAL NOT NULL DEFAULT 0,
      resultado TEXT NOT NULL DEFAULT '[]',
      markdown TEXT NOT NULL DEFAULT '',
      erro TEXT NOT NULL DEFAULT '',
      iniciado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      concluido_em TEXT
    );
    CREATE TABLE IF NOT EXISTS chats_biblioteca (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL DEFAULT 'Nova conversa',
      claude_session_id TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS chat_biblioteca_msgs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats_biblioteca(id),
      papel TEXT NOT NULL CHECK (papel IN ('usuario','claude','sistema')),
      texto TEXT NOT NULL,
      material_id INTEGER REFERENCES materiais(id),
      custo_usd REAL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS chat_biblioteca_propostas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES chats_biblioteca(id),
      msg_id INTEGER NOT NULL REFERENCES chat_biblioteca_msgs(id),
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      categorias TEXT NOT NULL,
      nivel TEXT,
      descricao TEXT NOT NULL,
      limitacoes TEXT NOT NULL DEFAULT '',
      origem TEXT NOT NULL DEFAULT '',
      relacao TEXT NOT NULL CHECK (relacao IN ('nova','parcial','duplicada')),
      existente TEXT NOT NULL DEFAULT '',
      resumo TEXT NOT NULL DEFAULT '',
      pilar TEXT NOT NULL DEFAULT '',
      explicacao TEXT NOT NULL DEFAULT '',
      justificativa_nivel TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'Pendente' CHECK (estado IN ('Pendente','Incorporada','Descartada','Substituída')),
      solucao_id INTEGER REFERENCES solucoes(id),
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS consultas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      pergunta TEXT NOT NULL,
      resposta TEXT NOT NULL,
      modo TEXT NOT NULL,
      trechos TEXT NOT NULL DEFAULT '[]',
      custo_usd REAL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TRIGGER IF NOT EXISTS consultas_sem_edicao BEFORE UPDATE ON consultas
      BEGIN SELECT RAISE(ABORT, 'consultas sao somente de acrescimo'); END;
    CREATE TRIGGER IF NOT EXISTS consultas_sem_exclusao BEFORE DELETE ON consultas
      BEGIN SELECT RAISE(ABORT, 'consultas sao somente de acrescimo'); END;
    CREATE VIRTUAL TABLE IF NOT EXISTS busca USING fts5(
      tipo UNINDEXED, ref_id UNINDEXED, projeto_id UNINDEXED, texto,
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER IF NOT EXISTS busca_projeto AFTER INSERT ON projetos
      BEGIN INSERT INTO busca (tipo, ref_id, projeto_id, texto) VALUES ('projeto', NEW.id, NEW.id, NEW.nome || ' ' || NEW.descricao); END;
    CREATE TRIGGER IF NOT EXISTS busca_anotacao AFTER INSERT ON anotacoes WHEN NEW.tipo <> 'Resolução'
      BEGIN INSERT INTO busca (tipo, ref_id, projeto_id, texto) VALUES ('anotacao', NEW.id, NEW.projeto_id, NEW.texto); END;
    CREATE TRIGGER IF NOT EXISTS busca_mensagem AFTER INSERT ON mensagens WHEN NEW.papel <> 'sistema'
      BEGIN INSERT INTO busca (tipo, ref_id, projeto_id, texto)
        VALUES ('mensagem', NEW.reuniao_id, (SELECT projeto_id FROM reunioes WHERE id = NEW.reuniao_id), NEW.texto); END;
    CREATE TRIGGER IF NOT EXISTS busca_solucao AFTER INSERT ON solucoes
      BEGIN INSERT INTO busca (tipo, ref_id, projeto_id, texto)
        VALUES ('solucao', NEW.id, 0, NEW.titulo || ' ' || NEW.descricao || ' ' || NEW.origem || ' ' || NEW.limitacoes); END;
    CREATE TRIGGER IF NOT EXISTS busca_evidencia AFTER INSERT ON evidencias
      BEGIN INSERT INTO busca (tipo, ref_id, projeto_id, texto) VALUES ('solucao', NEW.solucao_id, 0, NEW.descricao); END;
    CREATE TRIGGER IF NOT EXISTS busca_material AFTER INSERT ON materiais
      BEGIN INSERT INTO busca (tipo, ref_id, projeto_id, texto) VALUES ('material', NEW.id, 0, NEW.nome); END;
  `);
  migrar(db);
  return db;
}

// Completa colunas que faltem em bancos criados por versões anteriores. Nunca apaga nem altera dados existentes.
const COLUNAS_NOVAS: { tabela: string; coluna: string; ddl: string }[] = [
  { tabela: "pastas_autorizadas", coluna: "ativa", ddl: "ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0,1))" },
  { tabela: "solucoes", coluna: "nivel", ddl: "nivel TEXT CHECK (nivel IS NULL OR nivel IN ('BASE','SÊNIOR','STAFF'))" },
  { tabela: "solucoes", coluna: "chave_origem", ddl: "chave_origem TEXT" },
  { tabela: "solucao_categorias", coluna: "principal", ddl: "principal INTEGER NOT NULL DEFAULT 0 CHECK (principal IN (0,1))" },
  { tabela: "perfis_projeto", coluna: "anotacao_id", ddl: "anotacao_id INTEGER" },
  { tabela: "dossies", coluna: "origens", ddl: "origens TEXT NOT NULL DEFAULT '{}'" },
  { tabela: "solucoes", coluna: "resumo", ddl: "resumo TEXT NOT NULL DEFAULT ''" },
  { tabela: "solucoes", coluna: "pilar", ddl: "pilar TEXT NOT NULL DEFAULT ''" },
  { tabela: "solucoes", coluna: "explicacao", ddl: "explicacao TEXT NOT NULL DEFAULT ''" },
  { tabela: "solucoes", coluna: "justificativa_nivel", ddl: "justificativa_nivel TEXT NOT NULL DEFAULT ''" },
  { tabela: "solucoes", coluna: "nivel_por", ddl: "nivel_por TEXT NOT NULL DEFAULT ''" },
  { tabela: "pastas_autorizadas", coluna: "origem_url", ddl: "origem_url TEXT NOT NULL DEFAULT ''" },
  { tabela: "estudos", coluna: "passos", ddl: "passos INTEGER NOT NULL DEFAULT 0" },
  { tabela: "estudos", coluna: "lendo", ddl: "lendo TEXT NOT NULL DEFAULT ''" },
  { tabela: "chat_biblioteca_propostas", coluna: "reforco", ddl: "reforco TEXT NOT NULL DEFAULT ''" },
  { tabela: "chat_biblioteca_propostas", coluna: "conflito", ddl: "conflito TEXT NOT NULL DEFAULT ''" },
  { tabela: "chat_biblioteca_propostas", coluna: "resumo", ddl: "resumo TEXT NOT NULL DEFAULT ''" },
  { tabela: "chat_biblioteca_propostas", coluna: "pilar", ddl: "pilar TEXT NOT NULL DEFAULT ''" },
  { tabela: "chat_biblioteca_propostas", coluna: "explicacao", ddl: "explicacao TEXT NOT NULL DEFAULT ''" },
  { tabela: "chat_biblioteca_propostas", coluna: "justificativa_nivel", ddl: "justificativa_nivel TEXT NOT NULL DEFAULT ''" },
];

function migrar(d: DatabaseSync) {
  for (const c of COLUNAS_NOVAS) {
    const existe = (d.prepare(`PRAGMA table_info(${c.tabela})`).all() as { name: string }[]).some((x) => x.name === c.coluna);
    if (!existe) d.exec(`ALTER TABLE ${c.tabela} ADD COLUMN ${c.ddl}`);
  }
  d.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_solucoes_chave_origem ON solucoes(chave_origem) WHERE chave_origem IS NOT NULL");
  // Níveis que vieram escritos nos documentos do usuário ficam identificados como tal.
  d.exec("UPDATE solucoes SET nivel_por = 'Documento' WHERE nivel_por = '' AND nivel IS NOT NULL AND chave_origem LIKE 'fw:%'");
}

export function registrar(texto: string, projetoId: number | null = null) {
  conectar().prepare("INSERT INTO historico (projeto_id, texto) VALUES (?, ?)").run(projetoId, texto);
}

export function obterProjetoPorId(id: number): Projeto | undefined {
  return conectar().prepare("SELECT * FROM projetos WHERE id = ?").get(id) as Projeto | undefined;
}

export function listarProjetos(): Projeto[] {
  return conectar().prepare("SELECT * FROM projetos ORDER BY id DESC").all() as Projeto[];
}

export function obterProjeto(slug: string): Projeto | undefined {
  return conectar().prepare("SELECT * FROM projetos WHERE slug = ?").get(slug) as Projeto | undefined;
}

function gerarSlug(nome: string): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto";
  let slug = base;
  let i = 2;
  while (obterProjeto(slug)) slug = `${base}-${i++}`;
  return slug;
}

export function criarProjeto(d: { nome: string; tipo: string; descricao: string }): string {
  const slug = gerarSlug(d.nome);
  const r = conectar()
    .prepare("INSERT INTO projetos (slug, nome, tipo, descricao) VALUES (?, ?, ?, ?)")
    .run(slug, d.nome, d.tipo, d.descricao);
  registrar(`Projeto cadastrado: ${d.nome}`, Number(r.lastInsertRowid));
  return slug;
}

export function listarTarefas(projetoId: number): Tarefa[] {
  return conectar()
    .prepare("SELECT * FROM tarefas WHERE projeto_id = ? ORDER BY id DESC")
    .all(projetoId) as Tarefa[];
}

export function criarTarefa(d: { projetoId: number; pedido: string; nivel: number }) {
  conectar()
    .prepare("INSERT INTO tarefas (projeto_id, pedido, nivel) VALUES (?, ?, ?)")
    .run(d.projetoId, d.pedido, d.nivel);
  registrar(`Tarefa planejada (nível ${d.nivel}): ${d.pedido}`, d.projetoId);
}

export function obterTarefa(id: number): Tarefa | undefined {
  return conectar().prepare("SELECT * FROM tarefas WHERE id = ?").get(id) as Tarefa | undefined;
}

// A evidência de uma tarefa só recebe acréscimos: o texto novo é somado ao anterior.
export function registrarEvidenciaTarefa(tarefaId: number, texto: string) {
  const t = obterTarefa(tarefaId);
  const novo = texto.trim();
  if (!t) throw new Error("Tarefa não encontrada.");
  if (!novo || novo.length > 1500) throw new Error("Descreva a evidência em até 1500 caracteres.");
  const evidencia = t.evidencia ? `${t.evidencia}\n${novo}` : novo;
  conectar().prepare("UPDATE tarefas SET evidencia = ? WHERE id = ?").run(evidencia, tarefaId);
  registrar(`Evidência registrada na tarefa: ${t.pedido}`, t.projeto_id);
}

const ORDEM_TAREFA = ["Planejada", "Executada", "Validada"] as const;

export function mudarEstadoTarefa(tarefaId: number, estado: string) {
  const t = obterTarefa(tarefaId);
  if (!t) throw new Error("Tarefa não encontrada.");
  if (!(ORDEM_TAREFA as readonly string[]).includes(estado)) throw new Error("Estado inválido.");
  if (estado === "Validada" && !t.evidencia.trim()) throw new Error("Registre ao menos uma evidência antes de validar a tarefa.");
  conectar().prepare("UPDATE tarefas SET estado = ? WHERE id = ?").run(estado, tarefaId);
  registrar(`Tarefa "${t.pedido}": ${t.estado} para ${estado}`, t.projeto_id);
}

export type Material = {
  id: number;
  nome: string;
  hash: string;
  tamanho: number;
  extensao: string;
  caminho: string;
  versao: number;
  estado: string;
  observacao: string;
  recebido_em: string;
};

export type Analise = {
  material_id: number;
  linhas: number;
  palavras: number;
  categoria: string;
  topicos: string;
  criado_em: string;
};

export type Aprovacao = {
  id: number;
  tipo: string;
  titulo: string;
  origem: string;
  solucao_id: number | null;
  estado: "Pendente" | "Aprovada" | "Rejeitada";
  criado_em: string;
  decidido_em: string | null;
};

const SELECT_MATERIAL = "SELECT m.* FROM materiais m";

export function listarMateriais(): (Material & { categoria: string | null })[] {
  return conectar()
    .prepare(
      `SELECT m.*, a.categoria AS categoria
       FROM materiais m LEFT JOIN analises a ON a.material_id = m.id ORDER BY m.id DESC`,
    )
    .all() as (Material & { categoria: string | null })[];
}

export function obterMaterial(id: number): Material | undefined {
  return conectar().prepare(`${SELECT_MATERIAL} WHERE m.id = ?`).get(id) as Material | undefined;
}

export function obterMaterialPorHash(hash: string): Material | undefined {
  return conectar().prepare(`${SELECT_MATERIAL} WHERE m.hash = ?`).get(hash) as Material | undefined;
}

export function obterAnalise(materialId: number): Analise | undefined {
  return conectar().prepare("SELECT * FROM analises WHERE material_id = ?").get(materialId) as Analise | undefined;
}

export function ultimaVersao(nome: string): Material | undefined {
  return conectar()
    .prepare(`${SELECT_MATERIAL} WHERE m.nome = ? ORDER BY m.versao DESC LIMIT 1`)
    .get(nome) as Material | undefined;
}

export function registrarMaterial(d: {
  nome: string;
  hash: string;
  tamanho: number;
  extensao: string;
  caminho: string;
  versao: number;
  estado: string;
  observacao: string;
  analise: { linhas: number; palavras: number; categoria: string; topicos: string[] };
}): number {
  const c = conectar();
  const r = c
    .prepare(
      "INSERT INTO materiais (nome, hash, tamanho, extensao, caminho, versao, estado, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(d.nome, d.hash, d.tamanho, d.extensao, d.caminho, d.versao, d.estado, d.observacao);
  const id = Number(r.lastInsertRowid);
  c.prepare("INSERT INTO analises (material_id, linhas, palavras, categoria, topicos) VALUES (?, ?, ?, ?, ?)").run(
    id,
    d.analise.linhas,
    d.analise.palavras,
    d.analise.categoria,
    JSON.stringify(d.analise.topicos),
  );
  registrar(`Material recebido: ${d.nome} (versão ${d.versao}, estado ${d.estado})`);
  return id;
}

export function listarAprovacoes(): Aprovacao[] {
  return conectar()
    .prepare("SELECT * FROM aprovacoes ORDER BY (estado = 'Pendente') DESC, id DESC")
    .all() as Aprovacao[];
}

export function decidirAprovacao(id: number, decisao: "Aprovada" | "Rejeitada"): boolean {
  const c = conectar();
  const a = c.prepare("SELECT * FROM aprovacoes WHERE id = ?").get(id) as Aprovacao | undefined;
  if (!a || a.estado !== "Pendente") return false;
  c.prepare("UPDATE aprovacoes SET estado = ?, decidido_em = datetime('now','localtime') WHERE id = ?").run(decisao, id);
  if (a.tipo === "Solução" && a.solucao_id) {
    if (decisao === "Aprovada") {
      c.prepare("UPDATE solucoes SET situacao = 'Incorporada' WHERE id = ?").run(a.solucao_id);
      c.prepare("INSERT INTO incorporacoes (solucao_id, aprovacao_id) VALUES (?, ?)").run(a.solucao_id, id);
    } else {
      c.prepare("UPDATE solucoes SET situacao = 'Rejeitada' WHERE id = ?").run(a.solucao_id);
    }
  }
  registrar(`Aprovação ${decisao.toLowerCase()}: ${a.titulo}`);
  return true;
}

export type Mensagem = {
  id: number;
  reuniao_id: number;
  papel: "usuario" | "claude" | "sistema";
  texto: string;
  custo_usd: number | null;
  limite_5h: number | null;
  limite_7d: number | null;
  criado_em: string;
};

export type Reuniao = {
  id: number;
  projeto_id: number;
  titulo: string;
  claude_session_id: string | null;
  iniciada_em: string;
  encerrada_em: string | null;
};

export function criarReuniao(projetoId: number, titulo: string): number {
  const t = titulo.trim().slice(0, 120);
  if (!t) throw new Error("Dê um título para a reunião.");
  const r = conectar().prepare("INSERT INTO reunioes (projeto_id, titulo) VALUES (?, ?)").run(projetoId, t);
  registrar(`Reunião iniciada: ${t}`, projetoId);
  return Number(r.lastInsertRowid);
}

export function obterReuniao(id: number): Reuniao | undefined {
  return conectar().prepare("SELECT * FROM reunioes WHERE id = ?").get(id) as Reuniao | undefined;
}

export function listarReunioes(projetoId: number): Reuniao[] {
  return conectar().prepare("SELECT * FROM reunioes WHERE projeto_id = ? ORDER BY id DESC").all(projetoId) as Reuniao[];
}

export function encerrarReuniao(id: number) {
  const r = obterReuniao(id);
  if (!r || r.encerrada_em) return;
  conectar().prepare("UPDATE reunioes SET encerrada_em = datetime('now','localtime') WHERE id = ?").run(id);
  registrar(`Reunião encerrada: ${r.titulo}`, r.projeto_id);
}

export function salvarSessao(reuniaoId: number, sessionId: string) {
  conectar().prepare("UPDATE reunioes SET claude_session_id = ? WHERE id = ?").run(sessionId, reuniaoId);
}

export function listarMensagens(reuniaoId: number): Mensagem[] {
  return conectar().prepare("SELECT * FROM mensagens WHERE reuniao_id = ? ORDER BY id ASC").all(reuniaoId) as Mensagem[];
}

export function adicionarMensagem(d: {
  reuniaoId: number;
  papel: Mensagem["papel"];
  texto: string;
  custo?: number | null;
  limite5h?: number | null;
  limite7d?: number | null;
}) {
  conectar()
    .prepare(
      "INSERT INTO mensagens (reuniao_id, papel, texto, custo_usd, limite_5h, limite_7d) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(d.reuniaoId, d.papel, d.texto, d.custo ?? null, d.limite5h ?? null, d.limite7d ?? null);
}

export function listarHistorico(projetoId: number): Registro[] {
  return conectar()
    .prepare("SELECT * FROM historico WHERE projeto_id = ? ORDER BY id DESC LIMIT 20")
    .all(projetoId) as Registro[];
}
