import { Pool } from 'pg';
import { createDatabase } from './database.js';
import { ProductRepository } from './repositories/productRepository.js';
import { ensurePostgresProductSchema, PostgresProductRepository } from './repositories/postgresProductRepository.js';
import type { ProductStore } from './repositories/productStore.js';

interface Storage {
  repository: ProductStore;
  close(): Promise<void>;
}

export async function createStorage(env: NodeJS.ProcessEnv = process.env): Promise<Storage> {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    if (env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL é obrigatória em produção. Configure a conexão do Neon no Render.');
    }
    const database = createDatabase();
    return {
      repository: new ProductRepository(database),
      close: async () => { database.close(); }
    };
  }

  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 15_000 });
  pool.on('error', () => console.error('Conexão PostgreSQL interrompida.'));
  try {
    const directConnectionString = env.DATABASE_URL_UNPOOLED?.trim();
    const schemaPool = directConnectionString
      ? new Pool({ connectionString: directConnectionString, max: 1, connectionTimeoutMillis: 15_000 })
      : pool;
    try {
      await ensurePostgresProductSchema(schemaPool);
    } finally {
      if (schemaPool !== pool) await schemaPool.end();
    }
    return { repository: new PostgresProductRepository(pool), close: () => pool.end() };
  } catch {
    await pool.end();
    throw new Error('Não foi possível inicializar o PostgreSQL. Confira DATABASE_URL e a disponibilidade do Neon.');
  }
}
