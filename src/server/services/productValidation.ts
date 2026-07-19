import type { NormalizedProductInput } from '../../shared/product.js';

type ValidationResult =
  | { product: NormalizedProductInput; error?: never }
  | { error: string; product?: never };

export function validateProduct(body: unknown): ValidationResult {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const nome = String(data.nome ?? '').trim();
  const estabelecimento = String(data.estabelecimento ?? '').trim();
  const categoria = String(data.categoria ?? '').trim();
  const data_compra = String(data.data_compra ?? '').trim();
  const preco = Number(data.preco);
  const estoque = Number(data.estoque);
  const ativo = data.ativo === false || data.ativo === 0 ? 0 : 1;

  if (!nome) return { error: 'O nome do produto é obrigatório.' };
  if (!Number.isFinite(preco) || preco < 0) return { error: 'Informe um preço válido.' };
  if (!Number.isInteger(estoque) || estoque < 0) return { error: 'Informe um estoque inteiro e não negativo.' };

  return { product: { nome, estabelecimento, categoria, preco, estoque, ativo, data_compra } };
}
