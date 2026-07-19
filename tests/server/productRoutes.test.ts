import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { ensureProductSchema, ProductRepository } from '../../src/server/repositories/productRepository.js';

let database: Database.Database;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  database = new Database(':memory:');
  ensureProductSchema(database);
  app = createApp({ productRepository: new ProductRepository(database) });
});

afterEach(() => {
  database.close();
});

describe('product routes', () => {
  it('cria e lista produtos', async () => {
    const created = await request(app)
      .post('/api/produtos')
      .send({
        nome: 'Notebook',
        estabelecimento: 'Loja Centro',
        categoria: 'Informática',
        preco: 3500,
        estoque: 3,
        data_compra: '2026-07-19'
      })
      .expect(201);

    expect(created.body).toMatchObject({
      id: 1,
      nome: 'Notebook',
      estabelecimento: 'Loja Centro',
      categoria: 'Informática',
      preco: 3500,
      estoque: 3,
      ativo: 1,
      data_compra: '2026-07-19'
    });

    const listed = await request(app).get('/api/produtos?busca=centro').expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].nome).toBe('Notebook');
  });

  it('atualiza e remove produtos', async () => {
    await request(app)
      .post('/api/produtos')
      .send({ nome: 'Mouse', estabelecimento: '', categoria: 'Periféricos', preco: 80, estoque: 10, data_compra: '' })
      .expect(201);

    const updated = await request(app)
      .put('/api/produtos/1')
      .send({
        nome: 'Mouse Pro',
        estabelecimento: 'Marketplace',
        categoria: 'Periféricos',
        preco: 120,
        estoque: 8,
        ativo: false,
        data_compra: ''
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      nome: 'Mouse Pro',
      estabelecimento: 'Marketplace',
      preco: 120,
      estoque: 8,
      ativo: 0,
      data_compra: ''
    });

    await request(app).delete('/api/produtos/1').expect(204);
    const listed = await request(app).get('/api/produtos').expect(200);
    expect(listed.body).toEqual([]);
  });
});
