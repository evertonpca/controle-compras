import type { Product, ProductInput } from '../../shared/product.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function parseError(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.erro ?? 'Não foi possível concluir a operação.';
}

export async function listProducts(search = ''): Promise<Product[]> {
  const response = await fetch(`/api/produtos?busca=${encodeURIComponent(search)}`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function createProduct(product: ProductInput): Promise<Product> {
  const response = await fetch('/api/produtos', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(product)
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function updateProduct(id: number, product: ProductInput): Promise<Product> {
  const response = await fetch(`/api/produtos/${id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(product)
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function deleteProduct(id: number): Promise<void> {
  const response = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await parseError(response));
}
