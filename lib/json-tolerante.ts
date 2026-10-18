// Leitura tolerante do JSON que a IA devolve: um defeito pequeno não deve custar o estudo inteiro.

// Escapa quebras de linha cruas dentro de textos e tira vírgulas sobrando antes de } ou ].
export function limparJson(bruto: string): string {
  let saida = "";
  let dentro = false;
  let escape = false;
  for (const c of bruto) {
    if (dentro) {
      if (escape) { saida += c; escape = false; continue; }
      if (c === "\\") { saida += c; escape = true; continue; }
      if (c === '"') { dentro = false; saida += c; continue; }
      if (c === "\n") { saida += "\\n"; continue; }
      if (c === "\r") continue;
      if (c === "\t") { saida += "\\t"; continue; }
      saida += c;
    } else {
      if (c === '"') dentro = true;
      saida += c;
    }
  }
  return saida.replace(/,\s*([}\]])/g, "$1");
}

// Objetos { ... } completos dentro de um trecho, respeitando textos entre aspas.
export function objetosCompletos(trecho: string): string[] {
  const achados: string[] = [];
  let nivel = 0;
  let inicio = -1;
  let dentro = false;
  let escape = false;
  for (let i = 0; i < trecho.length; i++) {
    const c = trecho[i];
    if (dentro) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') dentro = false;
      continue;
    }
    if (c === '"') dentro = true;
    else if (c === "{") {
      if (nivel === 0) inicio = i;
      nivel++;
    } else if (c === "}" && nivel > 0) {
      nivel--;
      if (nivel === 0 && inicio >= 0) achados.push(trecho.slice(inicio, i + 1));
    }
  }
  return achados;
}

// Tenta ler como veio; se falhar, limpa; se ainda falhar, recupera achado por achado.
export function lerJsonTolerante(bruto: string): { dados: unknown; aviso: string } | null {
  try {
    return { dados: JSON.parse(bruto), aviso: "" };
  } catch {
    /* segue para a limpeza */
  }
  const limpo = limparJson(bruto);
  try {
    return { dados: JSON.parse(limpo), aviso: "O JSON da IA veio com defeitos simples e foi corrigido." };
  } catch {
    /* segue para a recuperação parcial */
  }
  const pos = limpo.search(/"achados"\s*:\s*\[/);
  if (pos < 0) return null;
  const resumoM = limpo.slice(0, pos).match(/"resumo"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const itens: unknown[] = [];
  let quebrados = 0;
  for (const o of objetosCompletos(limpo.slice(pos))) {
    try {
      itens.push(JSON.parse(o));
    } catch {
      quebrados++;
    }
  }
  if (itens.length === 0) return null;
  let resumo = "";
  if (resumoM) {
    try {
      resumo = JSON.parse(`"${resumoM[1]}"`) as string;
    } catch {
      resumo = resumoM[1];
    }
  }
  return {
    dados: { resumo, achados: itens },
    aviso: `O JSON da IA veio quebrado: ${itens.length} achado(s) recuperado(s)${quebrados ? ` e ${quebrados} perdido(s)` : ""}. Rode o estudo de novo se faltar algo.`,
  };
}
