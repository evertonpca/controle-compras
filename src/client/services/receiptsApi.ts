import type { ReceiptPreview } from '../../shared/receipt.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function parseError(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.erro ?? 'Nao foi possivel concluir a leitura da nota fiscal.';
}

export async function previewReceipt(qrCodeText: string): Promise<ReceiptPreview> {
  const response = await fetch('/api/notas-fiscais/preview', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ qrCodeText })
  });

  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}
