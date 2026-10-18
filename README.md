# Central de Engenharia

Leia qualquer repositório, compare com uma Biblioteca de boas práticas de engenharia e receba um relatório do que melhorar, com texto pronto para colar na IA que você usa no desenvolvimento.

Roda no seu computador, usa o **seu** login do Claude Code e só lê o código. Gratuito e de código aberto (MIT).

## O que ela faz

- **Biblioteca de Engenharia:** 158 itens em 13 categorias (segurança, desempenho e SEO, banco de dados, testes e outras), em 3 níveis: Júnior (todo sistema precisa), Sênior (o que separa o "funcionando" do "correto") e Staff (decisões de arquitetura). Cada item tem uma ficha: em uma frase, por que existe, técnica e conceitos.
- **Leitura de repositórios:** por link público do GitHub ou por pasta do seu computador. A IA lê uma cópia filtrada e aponta as boas práticas que o código já tem.
- **Relatório de melhorias:** compara um repositório com a Biblioteca, categoria por categoria, e mostra a cobertura, o que falta, a ordem de correção e um texto pronto para colar na sua IA. Sai em Markdown (.md).
- **PageSpeed:** mede qualquer site no Google PageSpeed Insights e compara antes e depois.
- **Novos conhecimentos:** envie textos (.txt e .md) e a IA os distribui nas categorias, sem duplicar o que já existe.

## Requisitos

| O quê | Para quê |
|---|---|
| **Node.js 22.13 ou mais novo** | Rodar a Central (`node -v` mostra a versão) |
| **Claude Code**, com login na sua conta | É ele que lê o código e escreve os relatórios |
| **Git** | Só para ler repositórios por link do GitHub |

A Central foi desenvolvida e testada no **Windows**. Mac e Linux devem funcionar, mas ainda não foram testados.

## Instalação

```bash
git clone https://github.com/fdevsilva/central-de-engenharia.git
cd central-de-engenharia
npm install
npm run dev
```

Abra **http://localhost:3000**. Na primeira vez, a tela inicial mostra um quadro de **Primeiros passos** que leva você, na ordem, até tudo funcionando.

## Primeiros passos (o que você precisa fazer)

1. **Instalar o Claude Code e entrar na sua conta.** Instale pelo instalador oficial (claude.com/claude-code), abra um terminal, rode `claude` e faça login. Se a Central não o encontrar, copie `.env.example` para `.env.local` e preencha `CLAUDE_BIN` com o caminho do programa.
2. **Carregar a Biblioteca base.** Um clique na tela inicial instala os 158 itens que acompanham a Central.
3. **Adicionar um repositório.** Em *Repositórios*, cole o link de um repositório público do GitHub ou autorize uma pasta do seu computador.
4. **Fazer a primeira leitura** e **gerar o primeiro relatório.** Os dois levam alguns minutos e mostram o andamento.

**Opcional: chave do PageSpeed.** Para medir sites, crie uma chave gratuita no Google Cloud (ative a *PageSpeed Insights API* e crie uma chave de API restrita a ela) e coloque no arquivo `.env.local`:

```
PAGESPEED_API_KEY=sua-chave
```

Reinicie a Central depois de mudar o `.env.local`. A chave fica só nesse arquivo, que o Git ignora.

## Variáveis do `.env.local`

Nada é obrigatório. Veja `.env.example`.

| Variável | Para quê |
|---|---|
| `PAGESPEED_API_KEY` | Medir sites no PageSpeed |
| `CLAUDE_BIN` | Caminho do Claude Code, se ele não for achado sozinho |
| `CENTRAL_MODELO_ESTUDO`, `CENTRAL_MODELO_RELATORIO`, `CENTRAL_MODELO_BIBLIOTECA` | Trocar o modelo de cada tarefa (padrão: `sonnet`) |

## Como usar

- **Repositórios:** adicione, leia e gere relatórios. Cada repositório mostra o custo da leitura e de cada relatório.
- **Relatório:** escolha o nível (Júnior, Sênior ou Staff, cumulativo) e as categorias. O relatório **nunca é gerado sozinho**: você pede quando quiser.
- **Aprovações:** o que contradiz um item da Biblioteca fica aqui, para você decidir. Itens de repositórios de terceiros (por link) **nunca entram sozinhos**: sempre esperam a sua aprovação.
- **Biblioteca:** navegue por categoria e por nível. Cada item mostra a ficha completa.

## Segurança e privacidade

- A Central **só lê**. Não altera nem executa nada do código lido.
- A IA lê uma **cópia filtrada**, sem `.env`, chaves, binários, `node_modules`, `.git` e arquivos que pareçam conter segredo. A cópia é apagada ao final.
- Os arquivos lidos passam pela **sua conta do Claude**, como em qualquer uso do Claude Code. Não leia código que você não pode enviar a esse serviço.
- Repositórios por link: só públicos, só HTTPS, baixados sem credenciais e sem executar nada. Prefira avisar a pessoa dona do repositório.
- Seus dados ficam na pasta `data/` do seu computador (banco SQLite, uploads e respostas). Ela não vai para o Git. Faça cópias de segurança dela se quiser guardar a sua Biblioteca.
- **A Central não tem login. Não a coloque na internet.** Ela foi feita para rodar só no seu computador.

## Custos

A Central usa o **limite do seu plano do Claude**. Os valores em dólar que ela mostra são o equivalente em API, só para você comparar. Medidos em repositórios reais: uma leitura custou de US$ 0,66 a US$ 1,56, e um relatório de um grupo de categorias, cerca de US$ 1,13. No plano com limite de uso, o que pesa é o limite, e não o dinheiro.

## Limites que você precisa conhecer

- O texto da Biblioteca (resumos, "por que existe", técnica) foi escrito por IA a partir de conhecimento geral de engenharia. **Não foi validado por especialistas.** Os itens ficam como "Recebido" ou "Analisado" até você registrar evidência.
- O relatório é feito só pela leitura do código. **"Não encontrado" significa que a IA procurou e não achou, e não prova que o item não exista.**
- A IA pode errar. Confira o que importa antes de aplicar.

## Seus dados e a Biblioteca

- A Biblioteca base vem em `conteudo/biblioteca-base.json` e é carregada pela tela inicial. Carregar de novo não duplica nada.
- Para exportar a sua própria Biblioteca (por exemplo, depois de enriquecê-la): `node scripts/exportar-biblioteca.mjs`.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Claude Code não encontrado" | Instale-o, rode `claude` uma vez para entrar na conta e, se preciso, defina `CLAUDE_BIN` no `.env.local` |
| Aviso "SQLite is an experimental feature" no terminal | Normal. Exige Node 22.13 ou mais novo |
| Erro ao ler repositório por link | Confira se o link é público e se o Git está instalado |
| PageSpeed recusa a medição | Confira a chave no `.env.local` e reinicie a Central |
| Porta 3000 ocupada | Rode `npx next dev -p 3001` |

## Contribuições

Sugestões e correções são bem-vindas, por *issue* ou *pull request*.

## Licença

MIT. Veja o arquivo `LICENSE`.
