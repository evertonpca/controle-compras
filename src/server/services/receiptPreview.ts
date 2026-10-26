import type { ReceiptItem, ReceiptPreview } from '../../shared/receipt.js';

const moneyPattern = /\b\d+(?:\.\d{3})*,\d{2}(?!\d)|\b\d+\.\d{2}(?!\d)/g;
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const money = (value: string) => Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const metadata = /^(?:CNPJ|CPF|IE\b|INSCR|RUA\b|AV\b|AVENIDA|RODOVIA|CEP|FONE|TEL\b|DANFE|DOCUMENTO|NOTA FISCAL|NFC-?E|CUPOM|CONSUMIDOR|CHAVE|PROTOCOLO|CONSULTE|HTTP|WWW\.|EMISSAO|DATA\b|HORA\b|SERIE\b|NUMERO\b|OPERADOR|CAIXA\b|TRIBUT|IBPT|OBRIGADO|VOLTE|AUTORIZ|CODIGO\s+DESCR|ITEM\s+COD|DESCRICAO\b|QTD\s+UN|VALOR\s+UNIT)/;
const summary = /^(?:SUB\s*TOTAL|TOTAL\b|VALOR\s+(?:TOTAL|A\s+PAGAR|PAGO)|QTD\.?\s*TOTAL|QUANTIDADE\s+TOTAL|FORMA\s+(?:DE\s+)?PAGAMENTO|DINHEIRO|PIX\b|CARTAO|CREDITO|DEBITO|TROCO|DESCONTO|ACRESCIMO)/;

export function normalizeReceiptName(value: string): string {
  const abbreviations: Record<string, string> = {
    REFRIG: 'Refrigerante', REFRI: 'Refrigerante', ACHOC: 'Achocolatado',
    BISC: 'Biscoito', DET: 'Detergente', DETERG: 'Detergente', SAB: 'Sabonete',
    INT: 'Integral', INTEG: 'Integral', DESN: 'Desnatado', ACUC: 'Açúcar',
    ACUCAR: 'Açúcar', CAFE: 'Café', FEIJAO: 'Feijão', MACARRAO: 'Macarrão', PAO: 'Pão', OLEO: 'Óleo'
  };
  return value
    .replace(/\(\s*c[oó]d(?:igo)?\.?\s*:?[^)]*\)/gi, '')
    .replace(/\b(?:EAN|NCM|CFOP|CST|CEST|COD(?:IGO)?)\s*[:.]?\s*\d+\b/gi, '')
    .replace(/^(?:\s*\d+[\s|:.-]+)+/, '')
    .replace(/\b\d{8,14}\b/g, '')
    .replace(/\s+(?:[A-F]\d?|\*)\s*$/, '')
    .replace(/[|_*]/g, ' ')
    .trim().split(/\s+/)
    .map((word) => abbreviations[fold(word).replace(/\.$/, '')] ?? (/^\d/.test(word) ? word.toLowerCase() : word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR')))
    .join(' ').slice(0, 120);
}

function category(name: string): string {
  const text = fold(name);
  if (/DETERG|SABAO|AMACIANTE|AGUA SANITARIA|DESINFET/.test(text)) return 'Limpeza';
  if (/SABONETE|SHAMPOO|DENTAL|HIGIEN|PAPEL HIG/.test(text)) return 'Higiene';
  if (/REFRIGERANTE|SUCO|CERVEJA|AGUA\b|VINHO/.test(text)) return 'Bebidas';
  return '';
}

export function buildReceiptPreview(text: unknown): { preview: ReceiptPreview; error?: never } | { error: string; preview?: never } {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Nao foi possivel ler o texto da nota. Tire outra foto com boa iluminacao.' };
  if (text.length > 100_000) return { error: 'O texto da nota excede o limite permitido.' };
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const warnings = ['Confira os nomes, quantidades e precos com a foto antes de importar.'];
  const estabelecimento = (lines.find((line) => /[a-zÀ-ÿ]/i.test(line) && !metadata.test(fold(line)) && !/\d{2}[/.:-]\d{2}/.test(line)) ?? '').slice(0, 120);
  const date = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const candidate = iso ?? (date ? `${date[3]}-${date[2]}-${date[1]}` : '');
  const data_compra = candidate && !Number.isNaN(Date.parse(candidate)) && new Date(candidate).toISOString().slice(0, 10) === candidate ? candidate : '';
  if (!data_compra) warnings.push('Data da compra nao identificada. Informe a data antes de importar.');
  const totalLine = lines.find((line) => /^(?:TOTAL(?:\s+A\s+PAGAR)?|VALOR\s+TOTAL|VALOR\s+A\s+PAGAR)\b/.test(fold(line)) && line.match(moneyPattern));
  const totalMatches = totalLine?.match(moneyPattern);
  const total_nota = totalMatches?.length ? money(totalMatches[totalMatches.length - 1]) : null;
  const items: ReceiptItem[] = [];
  let pending = '';
  let inTable = false;

  function addItem(rawName: string, quantity: number, price: number | null, lineTotal: number | null) {
    const nome = normalizeReceiptName(rawName);
    if (!/[a-zÀ-ÿ]{2}/i.test(nome)) return;
    if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1;
    if (!Number.isInteger(quantity)) {
      warnings.push(`${nome}: item por peso/volume registrado como 1 porcao pelo valor total (${quantity}).`);
      price = lineTotal ?? (price === null ? null : round(price * quantity));
      quantity = 1;
    } else if (lineTotal !== null) {
      price = round(lineTotal / quantity);
    }
    if (price === null) warnings.push(`${nome}: preco nao identificado. Preencha o valor.`);
    items.push({ nome, categoria: category(nome), estabelecimento, data_compra, estoque: quantity, preco: price, ativo: true });
  }

  for (const line of lines) {
    const normalized = fold(line);
    if (/^(?:DESCONTO|ACRESCIMO)/.test(normalized)) {
      warnings.push('A nota possui descontos/acrescimos. Confira os valores finais dos itens.');
      continue;
    }
    if (summary.test(normalized)) {
      if (pending) addItem(pending, 1, null, null);
      pending = '';
      if (items.length) break;
      continue;
    }
    if (/^(?:ITEM|CODIGO|DESCRICAO)\b/.test(normalized) && /DESCR|QTD|VALOR|PRODUTO/.test(normalized)) {
      inTable = true;
      pending = '';
      continue;
    }
    if (metadata.test(normalized) || /^\(?COD(?:IGO)?\s*[:.)]/.test(normalized) || /^[-=\s]+$/.test(line) || line === estabelecimento) continue;
    const prices = [...line.matchAll(moneyPattern)];
    const quantityMatch = normalized.match(/(?:QTD(?:E)?\.?\s*:?\s*)(\d+(?:[.,]\d+)?)/)
      ?? normalized.match(/(\d+(?:[.,]\d+)?)\s+(?:UN(?:ID)?|UND|KG|G|LT|L|PC|PCT)\b(?=\s*(?:[X×:]|\d|R\$))/)
      ?? normalized.match(/(\d+(?:[.,]\d+)?)\s*[X×]/);
    const quantity = quantityMatch ? Number(quantityMatch[1].replace(',', '.')) : 1;
    const quantityIndex = quantityMatch?.index ?? line.length;
    const firstPrice = prices[0]?.index ?? line.length;
    let name = line.slice(0, Math.min(firstPrice, quantityIndex)).replace(/\b(?:QTD(?:E)?\.?|UN\.?|VL\.?\s*UNIT\.?|R\$)\s*:?\s*$/i, '').trim();
    const startsItem = quantityIndex > 0 && (/^\d{1,14}\s+\D/.test(line) || /^\d{1,3}\s+\d{4,14}\s/.test(line));
    if (prices.length) {
      if (pending && !startsItem) name = `${pending} ${name}`.trim();
      else if (pending) addItem(pending, 1, null, null);
      pending = '';
      const lastPrice = money(prices[prices.length - 1][0]);
      addItem(name, quantity, prices.length > 1 ? money(prices[prices.length - 2][0]) : null, lastPrice);
      inTable = true;
    } else if (/[a-zÀ-ÿ]{2}/i.test(name) && (inTable || startsItem)) {
      if (startsItem && pending) {
        addItem(pending, 1, null, null);
        pending = '';
      }
      pending = `${pending} ${name}`.trim();
    }
    if (items.length >= 300) return { error: 'A nota excede o limite de 300 itens. Divida a nota em fotos menores.' };
  }
  if (pending) addItem(pending, 1, null, null);
  if (!items.length) return { error: 'Nao identifiquei produtos e precos. Fotografe a lista de itens de perto, sem cortar as colunas de valores.' };
  const calculated = items.reduce((sum, item) => sum + (item.preco ?? 0) * item.estoque, 0);
  if (total_nota !== null && Math.abs(calculated - total_nota) > 0.03) warnings.push('A soma dos itens difere do total da nota. Confira descontos, precos e itens ausentes.');
  return { preview: { source: 'photo-ocr', estabelecimento, data_compra, total_nota, items, warnings: [...new Set(warnings)] } };
}
