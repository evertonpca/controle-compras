import type { ProductInput } from './product.js';

export interface ReceiptPreview {
  source: 'nfce-qrcode';
  qrCodeText: string;
  estabelecimento: string;
  data_compra: string;
  items: ProductInput[];
  warnings: string[];
}

export interface ReceiptPreviewRequest {
  qrCodeText: string;
}
