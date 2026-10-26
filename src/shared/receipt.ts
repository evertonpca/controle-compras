import type { ProductInput } from './product.js';

export interface ReceiptItem extends Omit<ProductInput, 'preco'> {
  preco: number | null;
}

export interface ReceiptPreview {
  source: 'photo-ocr';
  estabelecimento: string;
  data_compra: string;
  items: ReceiptItem[];
  total_nota: number | null;
  warnings: string[];
}

export interface ReceiptPreviewRequest {
  text: string;
}
