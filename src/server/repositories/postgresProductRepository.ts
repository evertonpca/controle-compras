import type { Pool } from 'pg';
import type { NormalizedProductInput, Product } from '../../shared/product.js';
import type { ProductStore } from './productStore.js';

export async function ensurePostgresProductSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      estabelecimento TEXT NOT NULL DEFAULT '',
      categoria TEXT NOT NULL DEFAULT '',
      preco DOUBLE PRECISION NOT NULL CHECK (preco >= 0),
      estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
      ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
      data_compra TEXT NOT NULL DEFAULT '',
      purchase_id TEXT NOT NULL DEFAULT '',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function values(product: NormalizedProductInput) {
  return [product.nome, product.estabelecimento, product.categoria, product.preco,
    product.estoque, product.ativo, product.data_compra, product.purchase_id];
}

type PostgresProduct = Omit<Product, 'criado_em'> & { criado_em: Date | string };

function toProduct(row: PostgresProduct): Product {
  return { ...row, criado_em: row.criado_em instanceof Date ? row.criado_em.toISOString() : row.criado_em };
}

export class PostgresProductRepository implements ProductStore {
  constructor(private readonly pool: Pool) {}

  async list(searchTerm = ''): Promise<Product[]> {
    const result = await this.pool.query<PostgresProduct>(`
      SELECT * FROM produtos
      WHERE nome ILIKE $1 OR categoria ILIKE $1 OR estabelecimento ILIKE $1
      ORDER BY id DESC
    `, [`%${searchTerm.trim()}%`]);
    return result.rows.map(toProduct);
  }

  async create(product: NormalizedProductInput): Promise<Product> {
    const result = await this.pool.query<PostgresProduct>(`
      INSERT INTO produtos (nome, estabelecimento, categoria, preco, estoque, ativo, data_compra, purchase_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, values(product));
    return toProduct(result.rows[0]);
  }

  async update(id: number, product: NormalizedProductInput): Promise<Product | null> {
    const result = await this.pool.query<PostgresProduct>(`
      UPDATE produtos
      SET nome = $1, estabelecimento = $2, categoria = $3, preco = $4,
          estoque = $5, ativo = $6, data_compra = $7, purchase_id = $8
      WHERE id = $9 RETURNING *
    `, [...values(product), id]);
    return result.rows[0] ? toProduct(result.rows[0]) : null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM produtos WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
