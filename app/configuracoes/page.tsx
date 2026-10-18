import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Card, Badge, Lista, Linha, Pagina, Duas, Explica, Carregando } from "../components/ui";
import { temChave } from "../../lib/medicoes";
import { estadoGithub } from "../../lib/github";
import { regrasDeLeitura, ignoradosDosEstudos } from "../../lib/estudo";

const regras = [
  { t: "Acesso só ao autorizado", d: "A Central lê apenas as pastas que você liberar, e leitura é separada de escrita." },
  { t: "Aprovação para ações de impacto", d: "Push no GitHub, incorporação à Biblioteca e ampliação de escopo exigem sua decisão." },
  { t: "Sem segredos em texto claro", d: "Chaves e senhas nunca ficam na documentação, na Biblioteca ou em registros. A chave do Google fica só no arquivo .env.local, fora do Git." },
  { t: "Serviços externos só com o seu clique", d: "Medir no PageSpeed envia o endereço do site ao Google. Isso nunca acontece sozinho." },
  { t: "Rastreabilidade", d: "Comandos relevantes, arquivos alterados e aprovações ficam registrados." },
];

export default function Configuracoes() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  await connection();
  const chave = temChave();
  const github = await estadoGithub();
  const regra = regrasDeLeitura();
  const estudos = ignoradosDosEstudos();
  return (
    <Pagina>
      <PageHeader titulo="Configurações" sub="Integrações e permissões autorizadas." />
      <Duas
        principal={
          <>
          <Card titulo="Integrações e permissões">
            <Lista>
              <Linha titulo="Claude Code" texto="Executável local, usado em modo somente leitura e sem ferramentas" direita={<Badge tom="verde">Em uso</Badge>} />
              <Linha
                titulo="PageSpeed Insights (Google)"
                texto={chave ? "Chave configurada. Medições enviam só o endereço do site." : "Falta a chave gratuita. Veja o passo a passo na página de Medições de qualquer projeto."}
                direita={<Badge tom={chave ? "verde" : "amarelo"}>{chave ? "Chave configurada" : "Sem chave"}</Badge>}
              />
              <Linha
                titulo="GitHub"
                texto={github.logado ? `Logado como ${github.conta}. O envio de alterações só acontece quando você pedir.` : github.erro || "Não está logado. Rode gh auth login no terminal."}
                direita={<Badge tom={github.logado ? "verde" : "amarelo"}>{github.logado ? "Conectado" : "Desconectado"}</Badge>}
              />
              <Linha titulo="Pastas autorizadas" texto="Nenhuma pasta liberada para escrita" direita={<Badge>Somente leitura</Badge>} />
              <Linha
                titulo="Repositório da Central"
                texto={github.repositorio ? `${github.repositorio}, privado e separado dos projetos.` : "Ainda sem repositório remoto configurado."}
                direita={<Badge tom={github.repositorio ? "verde" : "amarelo"}>{github.repositorio ? "Criado" : "Não criado"}</Badge>}
              />
            </Lista>
          </Card>
          <Card titulo="O que a Central não lê nos repositórios">
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Ao estudar uma pasta, a IA nunca trabalha na pasta original: ela recebe uma cópia filtrada, só para leitura, com as ferramentas Read, Glob e Grep. Estas são as regras do filtro.
            </p>
            <dl className="flex flex-col divide-y divide-line text-sm">
              <div className="py-3 first:pt-0">
                <dt className="font-semibold">Arquivos sensíveis, nunca abertos</dt>
                <dd className="mt-1 leading-relaxed text-muted">{regra.sensiveis.join("; ")}. São descartados só pelo nome, sem serem lidos.</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Qualquer arquivo com cara de segredo</dt>
                <dd className="mt-1 leading-relaxed text-muted">Mesmo com nome comum, se o conteúdo tiver chave privada, token, chave de API ou senha, o arquivo inteiro não é copiado.</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Pastas ignoradas</dt>
                <dd className="mt-1 flex flex-wrap gap-2">{regra.pastas.map((p) => <span key={p} className="rounded-md border border-line px-2 py-0.5 text-xs">{p}</span>)}</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Arquivos de ruído ou instruções</dt>
                <dd className="mt-1 flex flex-wrap gap-2">{regra.arquivosDeRuido.map((p) => <span key={p} className="rounded-md border border-line px-2 py-0.5 text-xs">{p}</span>)}</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Só estes tipos de arquivo são lidos</dt>
                <dd className="mt-1 flex flex-wrap gap-2">{regra.extensoes.map((p) => <span key={p} className="rounded-md border border-line px-2 py-0.5 text-xs">{p}</span>)}</dd>
                <dd className="mt-1 text-xs text-muted">Imagens, PDF, planilhas, binários e qualquer outro tipo ficam de fora.</dd>
              </div>
              <div className="py-3">
                <dt className="font-semibold">Limites</dt>
                <dd className="mt-1 leading-relaxed text-muted">Até {regra.limites.porArquivoKB} KB por arquivo, {regra.limites.arquivos} arquivos e {regra.limites.totalMB} MB no total por estudo. Atalhos simbólicos não são seguidos, e nada fora da pasta autorizada é lido.</dd>
              </div>
            </dl>
          </Card>
          <Card titulo="O que já foi ignorado nos estudos feitos">
            {estudos.length === 0 ? (
              <p className="text-sm text-muted">Nenhum estudo foi feito ainda.</p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {estudos.map((e) => (
                  <details key={e.estudo} className="py-3 first:pt-0 last:pb-0">
                    <summary className="cursor-pointer text-sm">
                      <span className="font-semibold">Estudo #{e.estudo}: {e.pasta}</span>
                      <span className="ml-2 text-xs text-muted">{e.copiados} arquivo(s) lido(s), {e.grupos.reduce((n, g) => n + g.quantidade, 0)} ignorado(s)</span>
                    </summary>
                    {e.grupos.length === 0 ? (
                      <p className="mt-2 text-sm text-muted">Nada foi ignorado.</p>
                    ) : (
                      <ul className="mt-3 flex flex-col gap-2 text-sm">
                        {e.grupos.map((g) => (
                          <li key={g.motivo} className="leading-relaxed">
                            <span className="font-medium">{g.motivo}</span>
                            <span className="text-muted">: {g.quantidade}</span>
                            {g.exemplos.length > 0 && <span className="block text-xs text-muted">Exemplos: {g.exemplos.join(", ")}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                ))}
              </div>
            )}
          </Card>
          </>
        }
        lateral={<Explica titulo="Regras de segurança" itens={regras} />}
      />
    </Pagina>
  );
}
