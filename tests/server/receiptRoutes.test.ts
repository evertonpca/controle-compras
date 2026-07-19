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

describe('receipt routes', () => {
  it('gera previa de compra a partir do QR Code da nota', async () => {
    const preview = await request(app)
      .post('/api/notas-fiscais/preview')
      .send({
        qrCodeText: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43260712345678000123550010000012341000012345|2|1&vNF=42.90&dhEmi=2026-07-19T11:00:00-03:00'
      })
      .expect(200);

    expect(preview.body).toMatchObject({
      source: 'nfce-qrcode',
      data_compra: '2026-07-19'
    });
    expect(preview.body.estabelecimento).toContain('Nota fiscal');
    expect(preview.body.items).toHaveLength(1);
    expect(preview.body.items[0]).toMatchObject({
      categoria: 'Nota fiscal',
      preco: 42.9,
      estoque: 1
    });
  });

  it('valida conteudo vazio do QR Code', async () => {
    const response = await request(app)
      .post('/api/notas-fiscais/preview')
      .send({ qrCodeText: '' })
      .expect(400);

    expect(response.body.erro).toBe('Informe o conteudo do QR Code.');
  });
});
