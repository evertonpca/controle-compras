import type { ReceiptItem, ReceiptPreview } from '../../shared/receipt.js';

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const number = (value: string) => Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value);
const moneyPattern = /-?\b\d+(?:\.\d{3})*,\d{2}(?!\d)|-?\b\d+\.\d{2}(?!\d)/g;
const metadata = /^(?:CNPJ|CPF|IE\b|INSCR|RUA\b|AV\b|AVENIDA|RODOVIA|CEP|FONE|TEL\b|DANFE|DOCUMENTO|NOTA FISCAL|NFC-?E|CUPOM|CONSUMIDOR|CHAVE|PROTOCOLO|CONSULTE|HTTP|WWW\.|EMISSAO|DATA\b|HORA\b|SERIE\b|NUMERO\b|OPERADOR|CAIXA\b|TRIBUT|IBPT|OBRIGADO|VOLTE|AUTORIZ|VEND\b|CHECKOUT|ESTA COMPRA|NOS TERMOS|SIT[eE]F|MASTERCARD|VISA\b)/;
const footer = /^(?:Q[TDI][A-Z.]*\s*\.?\s*TOTAL|QUANTIDADE\s+TOTAL|SUB\s*TOTAL|TOTAL\b|VALOR\s+(?:TOTAL|A\s+PAGAR|PAGO)|FORMA\s*(?:DE\s*)?PAGAMENTO|DINHEIRO|PIX\b|CARTAO|CREDITO|DEBITO|TROCO|VAL\.?\s*APROX|TRIBUT|CONSUMIDOR|CONSULTE|CHAVE|PROTOCOLO)/;
const header = (line: string) => !/\d/.test(line) && /(?:COD.*DESCR|DESCR.*(?:QTD|QUANT|UNIT|VL|VALOR)|(?:QTD|QUANT).*(?:VL|VALOR|UNIT))/.test(fold(line));
const indexed = (line: string) => !/^\d+(?:[.,]\d+)?\s*(?:UN|KG|LT|L|G)\b/i.test(line) && /^\d{1,14}[\s|.:;-]+(?:(?:\d{3,14})[\s|]+)?[A-ZÀ-Ÿ]/i.test(line);

function amounts(line: string) {
  // Discount percentages and fractional weights are not monetary columns.
  return [...line.matchAll(moneyPattern)].filter((match) => !/^\s*%/.test(line.slice(match.index! + match[0].length)));
}

function cleanOcrNumbers(line: string): string {
  return line
    .replace(/\b[\dOIl]+[,.][\dOIl]{2,3}(?=\s|KG\b|K6\b|UN\b|$)/g, (value) => value.replace(/O/g, '0').replace(/[Il]/g, '1'))
    .replace(/(\d[,.]\d{3})\s*K6\b/gi, '$1KG')
    .replace(/\b(\d{1,2})\s+(\d{3})\s*(KG|G|L|LT)\b/gi, '$1,$2$3')
    .replace(/([A-Z])(\d+[,.]\d{3}\s*KG\b)/gi, '$1 $2');
}

export function normalizeReceiptName(value: string): string {
  const abbreviations: Record<string, string> = {
    REFRIG: 'Refrigerante', REFRI: 'Refrigerante', ACHOC: 'Achocolatado',
    BISC: 'Biscoito', DET: 'Detergente', DETERG: 'Detergente', SAB: 'Sabonete',
    INT: 'Integral', INTEG: 'Integral', DESN: 'Desnatado', ACUC: 'Açúcar',
    ACUCAR: 'Açúcar', CAFE: 'Café', FEIJAO: 'Feijão', MACARRAO: 'Macarrão', PAO: 'Pão', OLEO: 'Óleo',
    FILE: 'Filé', SUINO: 'Suíno', TEMP: 'Temperado', PLAST: 'Plástica', BIO: 'Biodegradável'
  };
  return value
    .replace(/\(\s*c[oó]d(?:igo)?\.?\s*:?[^)]*\)/gi, '')
    .replace(/\b(?:EAN|NCM|CFOP|CST|CEST|COD(?:IGO)?)\s*[:.]?\s*\d+\b/gi, '')
    .replace(/^(?:\s*\d+[\s|:;.-]+)+/, '')
    .replace(/\b\d{8,14}\b/g, '')
    .replace(/\bPC\s+A\s+VACUO\b/gi, '')
    .replace(/\b(BOVINO|SUINO|FRANGO)\s+DF\b/gi, '$1')
    .replace(/\bCOXA\s+C\s+SOBRECOXA\b/gi, 'Coxa e sobrecoxa')
    .replace(/\bS\s+OSSO\b/gi, 'Sem osso')
    .replace(/^Q\s+(?=GOUDA|MUSSARELA|PRATO|MINAS|PARMESAO)/i, 'Queijo ')
    .replace(/\bHOLANDES\b/gi, 'Holandês')
    .replace(/\s+(?:[A-F]\d?|\*)\s*$/, '')
    .replace(/[|_*]/g, ' ')
    .trim().split(/\s+/)
    .map((word) => abbreviations[fold(word).replace(/\.$/, '')] ?? (/^\d/.test(word) ? word.toLowerCase() : word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR')))
    .join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function category(name: string): string {
  const text = fold(name);
  if (/DETERG|SABAO|AMACIANTE|AGUA SANITARIA|DESINFET/.test(text)) return 'Limpeza';
  if (/SABONETE|SHAMPOO|DENTAL|HIGIEN|PAPEL HIG/.test(text)) return 'Higiene';
  if (/REFRIGERANTE|SUCO|CERVEJA|AGUA\b|VINHO/.test(text)) return 'Bebidas';
  return '';
}

function quantityColumn(line: string, firstPrice: number) {
  const labeled = /\bQTD(?:E)?\.?\s*:?\s*(\d+(?:[.,]\d{1,3})?)/i.exec(line);
  if (labeled) return { index: labeled.index, quantity: number(labeled[1]), unit: 'UN' };
  const candidates = [...line.matchAll(/\b(\d+(?:[.,]\d{1,3})?)\s*(UN(?:ID)?|UND|KG|G|LT|L|PC|PCT)\b/gi)];
  const column = candidates.reverse().find((match) => {
    if (match.index! > firstPrice) return false;
    // "5KG" / "1L" inside the description are package sizes, not quantities.
    const attachedPackage = /^\d+(?:KG|G|LT|L)$/i.test(match[0]);
    const after = line.slice(match.index! + match[0].length);
    return !attachedPackage && /^\s*(?:[x×:]\s*)?(?:R\$\s*)?-?\d/i.test(after);
  });
  if (column) return { index: column.index!, quantity: number(column[1]), unit: column[2].toUpperCase() };
  const times = /\b(\d+(?:[.,]\d{1,3})?)\s*[x×]/i.exec(line);
  return times ? { index: times.index, quantity: number(times[1]), unit: 'UN' } : null;
}

export function buildReceiptPreview(text: unknown): { preview: ReceiptPreview; error?: never } | { error: string; preview?: never } {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Nao foi possivel ler o texto da nota. Selecione somente a lista de produtos e tente novamente.' };
  if (text.length > 100_000) return { error: 'O texto da nota excede o limite permitido.' };
  const lines = text.split(/\r?\n/).map((line) => cleanOcrNumbers(line.replace(/\s+/g, ' ').trim())).filter(Boolean);
  const tableHeader = lines.findIndex(header);
  const firstItem = lines.findIndex((line) => !metadata.test(fold(line)) && !footer.test(fold(line)) && (indexed(line) || (amounts(line).length >= 2 && quantityColumn(line, amounts(line)[0].index!) !== null && /[a-zÀ-ÿ]{3}/i.test(line))));
  const start = tableHeader >= 0 ? tableHeader + 1 : firstItem;
  if (start < 0) return { error: 'Nao identifiquei a tabela de produtos. Selecione a area com os nomes e precos, incluindo todas as colunas.' };
  const endOffset = lines.slice(start).findIndex((line) => footer.test(fold(line)));
  const end = endOffset < 0 ? lines.length : start + endOffset;
  const tableLines = lines.slice(start, end);
  const estabelecimento = (lines.slice(0, tableHeader >= 0 ? tableHeader : firstItem).find((line) => /[a-zÀ-ÿ]{3}/i.test(line) && !metadata.test(fold(line)) && !/\d{2}[/.:-]\d{2}/.test(line)) ?? '').slice(0, 120);
  const date = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  const candidate = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? (date ? `${date[3]}-${date[2]}-${date[1]}` : '');
  const data_compra = candidate && !Number.isNaN(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0, 10) === candidate ? candidate : '';
  const warnings: string[] = [];
  if (!data_compra) warnings.push('Informe a data da compra.');
  const totalIndex = lines.findIndex((line) => /^(?:TOTAL(?:\s+A\s+PAGAR)?|VALOR\s+TOTAL|VALOR\s+A\s+PAGAR)\b/.test(fold(line)));
  const totalValues = totalIndex < 0 ? [] : amounts(lines[totalIndex]);
  if (totalIndex >= 0 && !totalValues.length && /^\s*\d[\d.,]*\s*$/.test(lines[totalIndex + 1] ?? '')) totalValues.push(...amounts(lines[totalIndex + 1]));
  const total_nota = totalValues.length ? number(totalValues.at(-1)![0]) : null;
  const items: ReceiptItem[] = [];
  let pending = '';

  function addItem(description: string, quantity: number, unit: string, unitPrice: number | null, total: number | null) {
    const nome = normalizeReceiptName(description);
    if (!/[a-zÀ-ÿ]{2}/i.test(nome)) return;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      warnings.push(`${nome}: confira a quantidade.`);
      quantity = 1;
    }
    const weighed = /^(?:KG|G|LT|L)$/.test(unit) || !Number.isInteger(quantity);
    if (unitPrice !== null && total !== null && Math.abs(round(quantity * unitPrice) - total) > 0.03) warnings.push(`${nome}: quantidade, preco unitario e total nao conferem. Revise com a foto.`);
    const preco = total === null ? null : weighed ? total : round(total / quantity);
    if (preco === null) warnings.push(`${nome}: preco nao identificado. Preencha o valor.`);
    items.push({ nome, categoria: category(nome), estabelecimento, data_compra, estoque: weighed ? 1 : quantity, preco, ativo: true,
      quantidade_lida: quantity, unidade_lida: unit, preco_unitario_lido: unitPrice });
  }

  function discount(line: string) {
    const last = items.at(-1);
    const values = amounts(line);
    if (!last || last.preco === null || !values.length) {
      warnings.push('Desconto nao identificado com seguranca. Confira o valor pago pelo item.');
      return;
    }
    const gross = round(last.preco * last.estoque);
    const negative = values.find((match) => number(match[0]) < 0);
    const reduction = Math.abs(number((negative ?? values[0])[0]));
    const net = values.length > 1 ? number(values.at(-1)![0]) : round(gross - reduction);
    if (net < 0 || net > gross || Math.abs(round(gross - reduction) - net) > 0.03) {
      warnings.push(`${last.nome}: desconto inconsistente. Confira o valor pago.`);
      return;
    }
    last.preco = round(net / last.estoque);
    warnings.push(`${last.nome}: desconto de R$ ${reduction.toFixed(2).replace('.', ',')} aplicado.`);
  }

  const numbered = tableLines.some(indexed);
  for (let row = 0; row < tableLines.length; row++) {
    const line = tableLines[row];
    const normalized = fold(line);
    if (/^DESCONTO\b/.test(normalized)) {
      const next = tableLines[row + 1] ?? '';
      if (!amounts(line).length && /^(?:R\$|[-\d.,%\s])+$/.test(next)) {
        discount(`${line} ${next}`);
        row++;
      } else discount(line);
      continue;
    }
    if (/^ACRESCIMO\b/.test(normalized)) { warnings.push('Confira o acrescimo no valor dos itens.'); continue; }
    if (metadata.test(normalized) || header(line) || /^\(?COD(?:IGO)?\s*[:.)]/.test(normalized) || /^[-=\s|]+$/.test(line)) continue;
    const startsItem = indexed(line) && !/^\d+(?:[.,]\d+)?\s*(?:UN|KG|LT|L|G)\b/i.test(line);
    const values = amounts(line);
    const quantity = quantityColumn(line, values[0]?.index ?? line.length);
    const name = line.slice(0, Math.min(values[0]?.index ?? line.length, quantity?.index ?? line.length))
      .replace(/\b(?:QTD(?:E)?\.?|UN\.?|VL\.?\s*UNIT\.?|R\$)\s*:?\s*$/i, '').trim();
    if (startsItem && pending) { addItem(pending, 1, 'UN', null, null); pending = ''; }
    if (values.length && (startsItem || pending || !numbered)) {
      const description = pending ? `${pending} ${name}` : name;
      addItem(description, quantity?.quantity ?? 1, quantity?.unit ?? 'UN', values.length > 1 ? number(values.at(-2)![0]) : null, number(values.at(-1)![0]));
      pending = '';
    } else if (/[a-zÀ-ÿ]{2}/i.test(name) && (startsItem || pending || !numbered)) {
      pending = `${pending} ${name}`.trim();
    }
    if (items.length > 300) return { error: 'A nota excede o limite de 300 itens. Divida a nota em fotos menores.' };
  }
  if (pending) addItem(pending, 1, 'UN', null, null);
  if (!items.length) return { error: 'Nao identifiquei produtos e precos. Selecione somente a tabela de produtos, com todas as colunas de valores.' };
  const countLine = lines.find((line) => /^Q[TDI][A-Z.]*\s*\.?\s*TOTAL.*ITEN/.test(fold(line)));
  const count = countLine?.match(/(\d+)\s*$/)?.[1];
  if (count && Number(count) !== items.length) warnings.push(`A nota informa ${count} itens, mas foram lidos ${items.length}. Confira a selecao da foto.`);
  const calculated = items.reduce((sum, item) => sum + (item.preco ?? 0) * item.estoque, 0);
  if (total_nota !== null && Math.abs(calculated - total_nota) > 0.03) warnings.push('A soma dos itens difere do total da nota. Confira descontos, precos e itens ausentes.');
  return { preview: { source: 'photo-ocr', estabelecimento, data_compra, total_nota, items, warnings: [...new Set(warnings)] } };
}
