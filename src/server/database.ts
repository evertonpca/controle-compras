import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { ensureProductSchema } from './repositories/productRepository.js';

export function createDatabase(dbPath?: string): Database.Database {
  const dataDirectory = path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDirectory, { recursive: true });

  const database = new Database(dbPath ?? path.join(dataDirectory, 'produtos.db'));
  ensureProductSchema(database);
  return database;
}
