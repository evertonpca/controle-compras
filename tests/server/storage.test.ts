import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { createStorage } from '../../src/server/storage.js';
import type { ProductStore } from '../../src/server/repositories/productStore.js';

describe('production storage', () => {
  it('impede SQLite temporário em produção sem DATABASE_URL', async () => {
    await expect(createStorage({ NODE_ENV: 'production' })).rejects.toThrow('DATABASE_URL');
    await expect(createStorage({ NODE_ENV: 'production', DATABASE_URL: '  ' })).rejects.toThrow('DATABASE_URL');
  });

  it('encaminha falhas assíncronas do banco para o tratamento de erros da API', async () => {
    const repository: ProductStore = {
      list: async () => { throw new Error('Conexão indisponível'); },
      create: vi.fn(), update: vi.fn(), delete: vi.fn()
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(createApp({ productRepository: repository }))
        .get('/api/produtos').expect(500);
      expect(response.body).toEqual({ erro: 'Ocorreu um erro interno.' });
    } finally {
      log.mockRestore();
    }
  });
});
