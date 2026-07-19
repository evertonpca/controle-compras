import type { ProductInput } from '../../shared/product.js';
import type { ReceiptPreview } from '../../shared/receipt.js';

function todayIsoDate() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function titleFromHost(host: string) {
  const cleanedHost = host.replace(/^www\./, '').split('.');
  const meaningfulPart = cleanedHost.find((part) => !['sefaz', 'fazenda', 'gov', 'br', 'nfce'].includes(part)) ?? cleanedHost[0];
  return meaningfulPart ? `Nota fiscal ${meaningfulPart.toUpperCase()}` : 'Nota fiscal importada';
}

function parseQrUrl(qrCodeText: string): URL | null {
  try {
    return new URL(qrCodeText);
  } catch {
    return null;
  }
}

function numberFromParam(params: URLSearchParams, names: string[]) {
  for (const name of names) {
    const rawValue = params.get(name);
    if (!rawValue) continue;

    const normalizedValue = rawValue.includes(',')
      ? rawValue.replace(/\./g, '').replace(',', '.')
      : rawValue;
    const value = Number(normalizedValue);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return 0;
}

function dateFromParam(params: URLSearchParams) {
  const rawDate = params.get('dhEmi') ?? params.get('dEmi') ?? params.get('data') ?? '';
  const isoDate = rawDate.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;

  const compactDate = rawDate.match(/(\d{4})(\d{2})(\d{2})/);
  if (compactDate) return `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`;

  return todayIsoDate();
}

function paramsFromQr(url: URL | null, qrCodeText: string) {
  const params = new URLSearchParams(url?.search ?? '');
  const pipePayload = params.get('p') ?? qrCodeText.split('?p=')[1] ?? '';
  const [accessKey] = pipePayload.split('|');
  if (accessKey && !params.has('chNFe')) params.set('chNFe', accessKey);
  return params;
}

export function buildReceiptPreview(qrCodeText: unknown): { preview: ReceiptPreview; error?: never } | { error: string; preview?: never } {
  const normalizedQrCodeText = String(qrCodeText ?? '').trim();
  if (!normalizedQrCodeText) return { error: 'Informe o conteudo do QR Code.' };

  const url = parseQrUrl(normalizedQrCodeText);
  const params = paramsFromQr(url, normalizedQrCodeText);
  const estabelecimento = url ? titleFromHost(url.hostname) : 'Nota fiscal importada';
  const data_compra = dateFromParam(params);
  const total = numberFromParam(params, ['vNF', 'vCFe', 'valor', 'total', 'vlTotal']);
  const accessKey = params.get('chNFe') ?? params.get('chave') ?? '';
  const itemName = accessKey ? `Nota fiscal ${accessKey.slice(-8)}` : 'Nota fiscal importada';
  const items: ProductInput[] = [{
    nome: itemName,
    estabelecimento,
    categoria: 'Nota fiscal',
    preco: total,
    estoque: 1,
    ativo: true,
    data_compra
  }];

  return {
    preview: {
      source: 'nfce-qrcode',
      qrCodeText: normalizedQrCodeText,
      estabelecimento,
      data_compra,
      items,
      warnings: [
        'A leitura inicial salva a compra pelo QR Code. Quando o portal da SEFAZ nao expuser os itens no link, revise o item importado antes de salvar.'
      ]
    }
  };
}
