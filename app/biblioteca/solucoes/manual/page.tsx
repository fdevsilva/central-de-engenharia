import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, Card, Campo, Botao, Pagina, Carregando, Duas, Explica } from "../../../components/ui";
import { obterMaterial } from "../../../../lib/db";
import { CATEGORIAS, TIPOS_SOLUCAO } from "../../../../lib/categorias";
import { ESTADOS_INICIAIS, NIVEIS, ROTULO_NIVEL, SIGNIFICADO_NIVEL } from "../../../../lib/solucoes";
import { salvarSolucao } from "../../../actions";

type Params = Promise<Record<string, string | undefined>>;

export default function Nova({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

const regras = [
  { t: "Origem obrigatória", d: "Toda solução precisa dizer de onde veio: projeto, arquivo ou material recebido." },
  { t: "Uma ou mais categorias", d: "Escolha as áreas em que a solução se aplica. Ela aparece em todas elas." },
  { t: "Limitações honestas", d: "Registre o que a solução não resolve e onde não deve ser usada. Campo vazio fica sinalizado." },
  { t: "Validação depois", d: "Ao propor, o estado não pode ser validado. Primeiro registre evidências, depois valide." },
  { t: "Você aprova", d: "A solução fica em análise até você aprovar em Aprovações. Só então conta como incorporada." },
];

async function Conteudo({ searchParams }: { searchParams: Params }) {
  const q = await searchParams;
  await connection();
  const materialId = Number(q.material);
  const material = Number.isInteger(materialId) && materialId > 0 ? obterMaterial(materialId) : undefined;
  const origemInicial = material ? `Material recebido: ${material.nome} (versão ${material.versao})` : "";

  return (
    <Pagina>
      <PageHeader titulo="Nova solução" sub="Procedimentos, códigos, padrões e conhecimentos, com origem e validação." />
      {q.erro && (
        <div role="alert" className="mb-4 rounded-lg border border-warn/40 bg-[rgba(229,185,78,0.06)] px-4 py-3 text-sm">
          {q.erro}
        </div>
      )}
      <Duas
        principal={
          <Card>
            <form action={salvarSolucao} className="flex flex-col gap-5">
              {material && <input type="hidden" name="material" value={material.id} />}
              <Campo id="titulo" label="Título" />
              <div>
                <label htmlFor="tipo" className="mb-1.5 block text-xs text-muted">Tipo</label>
                <select id="tipo" name="tipo" className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm">
                  {TIPOS_SOLUCAO.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-xs text-muted">Categorias (ao menos uma)</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CATEGORIAS.map((c) => (
                    <label key={c.slug} className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm has-[:checked]:border-accent">
                      <input type="checkbox" name="categorias" value={c.slug} defaultChecked={q.categoria === c.slug} className="accent-[var(--accent)]" />
                      {c.nome}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="nivel" className="mb-1.5 block text-xs text-muted">Nível (opcional)</label>
                <select id="nivel" name="nivel" defaultValue="" className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm">
                  <option value="">Sem nível</option>
                  {NIVEIS.map((n) => (
                    <option key={n} value={n}>{ROTULO_NIVEL[n]}: {SIGNIFICADO_NIVEL[n]}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">Use quando o item for um requisito que pode ou não ser exigido conforme o projeto. A primeira categoria marcada acima é a principal.</p>
              </div>
              <Campo id="descricao" label="Descrição: o que é e como usar" area />
              <div>
                <label htmlFor="origem" className="mb-1.5 block text-xs text-muted">Origem (obrigatória)</label>
                <input
                  id="origem"
                  name="origem"
                  defaultValue={origemInicial}
                  placeholder="Projeto, arquivo ou material de onde veio"
                  className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm placeholder:text-muted"
                />
              </div>
              <Campo id="limitacoes" label="Limitações conhecidas" area />
              <div>
                <label htmlFor="estado" className="mb-1.5 block text-xs text-muted">Estado inicial</label>
                <select id="estado" name="estado" className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm">
                  {ESTADOS_INICIAIS.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Botao enviar>Propor solução</Botao>
              </div>
            </form>
          </Card>
        }
        lateral={<Explica titulo="Como cadastrar" itens={regras} />}
      />
    </Pagina>
  );
}
