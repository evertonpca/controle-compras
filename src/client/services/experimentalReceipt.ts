export interface ExperimentalReceiptItem {
  nome: string;
  preco: number;
}

export const receiptAiPrompt = `Analise a foto da nota fiscal anexada e extraia somente os nomes dos produtos e os respectivos valores totais pagos por linha.
Responda SOMENTE com JSON válido neste formato exato, sem Markdown, blocos de código, comentários ou explicações:
{"itens":[{"nome":"Nome do produto","preco":12.34}]}
Regras:
- Use apenas as chaves "itens", "nome" e "preco". Não inclua estabelecimento, data, categoria ou quantidade.
- "preco" deve ser um número em reais, com ponto decimal e no máximo duas casas decimais, sem R$ e sem separador de milhares.
- Use o TOTAL da linha do produto, nunca o preço unitário. Exemplo: 2 unidades a R$ 5,00 resultam em uma linha com preco 10.00. Para produtos por peso, use o valor pago pela porção.
- Mantenha cada linha de produto separada, inclusive produtos repetidos. Não agrupe e não multiplique novamente os valores.
- Aplique descontos explicitamente associados ao produto. Não distribua descontos gerais nem invente valores.
- Não inclua subtotal, total da nota, troco, pagamento, tributos ou itens cancelados.
- Em "nome", escreva o nome comum do produto em português, curto, legível, com acentos e sem usar tudo em maiúsculas. Não copie a descrição fiscal literalmente.
- Remova marcas, fabricantes, nomes de lojas, códigos, referências internas, números soltos, peso, volume, dimensões, quantidade e detalhes de embalagem (como "PC", "a vácuo", "GR" e "20"). Remova também termos promocionais e informações truncadas sem significado claro.
- Expanda abreviações somente quando o contexto permitir identificar o produto com segurança (por exemplo, "Q GOUDA" vira "Queijo gouda"). Preserve apenas características que ajudam a distinguir o alimento ou produto, como bovino/suíno, tipo de queijo, caipira ou sem osso. Não reduza todos os cortes a "Carne" nem todos os tipos de queijo a "Queijo".
- Exemplos de limpeza de nomes:
  "FILE MIGNON BOVINO PC A VACUO GR" → "Filé mignon bovino"
  "FILE MIGNON SUINO OBA AVE TEMP" → "Filé mignon suíno"
  "COXA C SOBRECOXA S OSSO OBA" → "Coxa e sobrecoxa sem osso"
  "Q GOUDA HOLANDES LANDANA 20" → "Queijo gouda"
  "OVO CAIPIRA MANTIQUEIRA VER" → "Ovo caipira"
  "SACOLA PLAST BIO BSB 48X55" → "Sacola plástica"
- Limpe somente os nomes: mantenha os preços e todas as linhas de produtos, inclusive linhas repetidas e sacolas cobradas. Não invente produtos, características ou preços. Se não for possível identificar um produto ou preço com segurança, peça uma foto mais nítida em vez de gerar um JSON incompleto.
- Confira os valores com a foto antes de responder. Se não houver produtos, retorne {"itens":[]}.`;

export function parseExperimentalReceipt(text: string): ExperimentalReceiptItem[] {
  // Alguns assistentes ainda envolvem o JSON em um bloco Markdown.
  const normalized = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  let data: unknown;
  try {
    data = JSON.parse(normalized);
  } catch {
    throw new Error('Resposta inválida. Cole o JSON completo gerado com o prompt, sem explicações adicionais.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).length !== 1 || !('itens' in data) || !Array.isArray(data.itens)) {
    throw new Error('Use o formato {"itens":[{"nome":"Produto","preco":12.34}]}.');
  }
  if (!data.itens.length) throw new Error('A resposta não contém produtos. Envie uma foto legível para a IA.');
  if (data.itens.length > 500) throw new Error('Importe no máximo 500 linhas por compra.');
  return data.itens.map((item: unknown, index: number) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).length !== 2 || !('nome' in item) || !('preco' in item)
      || typeof item.nome !== 'string' || !item.nome.trim() || item.nome.trim().length > 120
      || typeof item.preco !== 'number' || !Number.isFinite(item.preco) || item.preco < 0
      || !Number.isSafeInteger(Math.round(item.preco * 100))
      || Math.abs(item.preco * 100 - Math.round(item.preco * 100)) > 0.000001) {
      throw new Error(`Confira o item ${index + 1}: nome de até 120 caracteres e preço numérico não negativo com até duas casas decimais.`);
    }
    return { nome: item.nome.trim(), preco: item.preco };
  });
}
