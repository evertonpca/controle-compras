import type { NormalizedProductInput, Product } from '../../shared/product.js';

type Result<T> = T | Promise<T>;

export interface ProductStore {
  list(searchTerm?: string): Result<Product[]>;
  create(product: NormalizedProductInput): Result<Product>;
  update(id: number, product: NormalizedProductInput): Result<Product | null>;
  delete(id: number): Result<boolean>;
}
