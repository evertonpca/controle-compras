import Database from 'better-sqlite3';
import request from 'supertest';
import { newDb } from 'pg-mem';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { ensureProductSchema, ProductRepository } from '../../src/server/repositories/productRepository.js';
import { ensurePostgresProductSchema, PostgresProductRepository } from '../../src/server/repositories/postgresProductRepository.js';

describe.each(['sqlite', 'postgres'])('product routes (%s)', (provider) => {
  let app: ReturnType<typeof createApp>;
  let closeDatabase: () => void | Promise<void>;

  beforeEach(async () => {
    if (provider === 'postgres') {
      const { Pool } = newDb().adapters.createPg();
      const pool = new Pool();
      await ensurePostgresProductSchema(pool);
      app = createApp({ productRepository: new PostgresProductRepository(pool) });
      closeDatabase = () => pool.end();
    } else {
      const database = new Database(':memory:');
      ensureProductSchema(database);
      app = createApp({ productRepository: new ProductRepository(database) });
      closeDatabase = () => { database.close(); };
    }
  });

  afterEach(async () => {
    await closeDatabase();
  });

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

  it('preserva o grupo da compra e os tipos usados pelo dashboard', async () => {
    const input = { nome: 'Arroz', estabelecimento: 'Mercado', categoria: 'Alimentos',
      preco: 12.5, estoque: 2, ativo: true, data_compra: '', purchase_id: 'compra-teste' };
    const first = await request(app).post('/api/produtos').send(input).expect(201);
    const second = await request(app).post('/api/produtos').send({ ...input, nome: 'Feijao' }).expect(201);
    expect(first.body).toMatchObject({ preco: 12.5, estoque: 2, ativo: 1, purchase_id: 'compra-teste', data_compra: '' });
    expect(typeof first.body.criado_em).toBe('string');
    const listed = await request(app).get('/api/produtos?busca=MERCADO').expect(200);
    expect(listed.body.map((item: { id: number }) => item.id)).toEqual([second.body.id, first.body.id]);
    await request(app).put('/api/produtos/999').send(input).expect(404);
    await request(app).delete('/api/produtos/999').expect(404);
  });
});
