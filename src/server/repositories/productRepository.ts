import type Database from 'better-sqlite3';
import type { NormalizedProductInput, Product } from '../../shared/product.js';

export function ensureProductSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL DEFAULT '',
      estabelecimento TEXT NOT NULL DEFAULT '',
      categoria TEXT NOT NULL DEFAULT '',
      preco REAL NOT NULL CHECK (preco >= 0),
      estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
      ativo INTEGER NOT NULL DEFAULT 1,
      data_compra TEXT NOT NULL DEFAULT '',
      purchase_id TEXT NOT NULL DEFAULT '',
      criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = db.prepare('PRAGMA table_info(produtos)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('estabelecimento')) {
    db.exec("ALTER TABLE produtos ADD COLUMN estabelecimento TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE produtos SET estabelecimento = descricao WHERE estabelecimento = ''");
  }

  if (!columnNames.has('data_compra')) {
    db.exec("ALTER TABLE produtos ADD COLUMN data_compra TEXT NOT NULL DEFAULT ''");
  }

  if (!columnNames.has('purchase_id')) {
    db.exec("ALTER TABLE produtos ADD COLUMN purchase_id TEXT NOT NULL DEFAULT ''");
  }
}

export class ProductRepository {
  constructor(private readonly db: Database.Database) {}

  list(searchTerm = ''): Product[] {
    const busca = `%${searchTerm.trim()}%`;
    return this.db.prepare(`
      SELECT id, nome, estabelecimento, categoria, preco, estoque, ativo, data_compra, purchase_id, criado_em
      FROM produtos
      WHERE nome LIKE ? OR categoria LIKE ? OR estabelecimento LIKE ?
      ORDER BY id DESC
    `).all(busca, busca, busca) as Product[];
  }

  create(product: NormalizedProductInput): Product {
    const info = this.db.prepare(`
      INSERT INTO produtos (nome, estabelecimento, categoria, preco, estoque, ativo, data_compra, purchase_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product.nome,
      product.estabelecimento,
      product.categoria,
      product.preco,
      product.estoque,
      product.ativo,
      product.data_compra,
      product.purchase_id
    );

    return this.findById(Number(info.lastInsertRowid)) as Product;
  }

  update(id: number, product: NormalizedProductInput): Product | null {
    const info = this.db.prepare(`
      UPDATE produtos
      SET nome = ?, estabelecimento = ?, categoria = ?, preco = ?, estoque = ?, ativo = ?, data_compra = ?, purchase_id = ?
      WHERE id = ?
    `).run(
      product.nome,
      product.estabelecimento,
      product.categoria,
      product.preco,
      product.estoque,
      product.ativo,
      product.data_compra,
      product.purchase_id,
      id
    );

    if (!info.changes) return null;
    return this.findById(id);
  }

  delete(id: number): boolean {
    const info = this.db.prepare('DELETE FROM produtos WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private findById(id: number): Product | null {
    return this.db.prepare(`
      SELECT id, nome, estabelecimento, categoria, preco, estoque, ativo, data_compra, purchase_id, criado_em
      FROM produtos
      WHERE id = ?
    `).get(id) as Product | undefined ?? null;
  }
}
