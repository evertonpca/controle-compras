import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { ensureProductSchema, ProductRepository } from '../../src/server/repositories/productRepository.js';
import { buildReceiptPreview, normalizeReceiptName } from '../../src/server/services/receiptPreview.js';

let database: Database.Database;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  database = new Database(':memory:');
  ensureProductSchema(database);
  app = createApp({ productRepository: new ProductRepository(database) });
});
afterEach(() => database.close());

const receipt = `MERCADO EXEMPLO
CNPJ: 12.345.678/0001-90
Emissao: 25/10/2026 12:30
ITEM CODIGO DESCRICAO QTD UN VL UNIT TOTAL
001 7891234567890 ARROZ TIO JOAO 5KG 2 UN x 22,90 45,80
002 1234 LEITE INT PIRACANJUBA 1L
1 UN x 5,49 5,49
003 9876 REFRIG COCA COLA 2L 1 UN x 9,99 9,99
TOTAL R$ 61,28
DINHEIRO 70,00
TROCO 8,72`;

describe('importacao por foto', () => {
  it('extrai produtos, quantidades, precos unitarios e total sem incluir pagamentos', async () => {
    const response = await request(app).post('/api/notas-fiscais/preview').send({ text: receipt }).expect(200);
    expect(response.body).toMatchObject({ source: 'photo-ocr', estabelecimento: 'MERCADO EXEMPLO', data_compra: '2026-10-25', total_nota: 61.28 });
    expect(response.body.items).toHaveLength(3);
    expect(response.body.items).toMatchObject([
      { nome: 'Arroz Tio Joao 5kg', estoque: 2, preco: 22.9 },
      { nome: 'Leite Integral Piracanjuba 1l', estoque: 1, preco: 5.49 },
      { nome: 'Refrigerante Coca Cola 2l', estoque: 1, preco: 9.99 }
    ]);
    const before = await request(app).get('/api/produtos').expect(200);
    expect(before.body).toHaveLength(0);
    for (const item of response.body.items) await request(app).post('/api/produtos').send({ ...item, purchase_id: 'foto-teste' }).expect(201);
    const after = await request(app).get('/api/produtos').expect(200);
    expect(after.body).toHaveLength(3);
  });

  it('interpreta quantidade e valores rotulados em outra linha', () => {
    const result = buildReceiptPreview(`MERCADO
001 BISC. RECHEADO 130G (Codigo: 7891234567890)
Qtde.: 2 UN: UN Vl. Unit.: 3,50 Vl. Total: 7,00
TOTAL 7,00`);
    expect(result.preview?.items).toMatchObject([{ nome: 'Biscoito Recheado 130g', preco: 3.5, estoque: 2 }]);
  });

  it('preserva o total de produtos por peso com aviso', () => {
    const result = buildReceiptPreview('MERCADO\n001 BANANA PRATA 0,750 KG x 8,00 6,00\nTOTAL 6,00');
    expect(result.preview?.items).toMatchObject([{ nome: 'Banana Prata', preco: 6, estoque: 1 }]);
    expect(result.preview?.warnings.some((warning) => warning.includes('peso/volume'))).toBe(true);
  });

  it('nao inventa preco quando a linha esta ilegivel e alerta diferenca de total', () => {
    const result = buildReceiptPreview('MERCADO\n001 CAFE 500G\n002 ACUCAR 1KG 1 UN x 5,00 5,00\nTOTAL 20,00');
    expect(result.preview?.items).toMatchObject([{ nome: 'Café 500g', preco: null }, { nome: 'Açúcar 1kg', preco: 5 }]);
    expect(result.preview?.warnings.join(' ')).toContain('difere');
  });

  it('limpa codigos e expande abreviacoes preservando marca e embalagem', () => {
    expect(normalizeReceiptName('001 7891234567890 DET. YPE 500ML NCM: 34022000 CFOP 5102 F1')).toBe('Detergente Ype 500ml');
  });

  it('nao transforma dados fiscais ou valores de pagamento em produtos', () => {
    const result = buildReceiptPreview('MERCADO\nCNPJ: 12.345.678/0001-90\nVALOR TOTAL 50,00\nPIX 50,00\nTRIBUTOS 5,00');
    expect(result.error).toContain('Nao identifiquei');
  });

  it('continua lendo produtos depois de um desconto por item', () => {
    const result = buildReceiptPreview('MERCADO\n001 LEITE 1 UN x 6,00 6,00\nDESCONTO 1,00\n002 CAFE 1 UN x 8,00 8,00\nTOTAL 13,00');
    expect(result.preview?.items).toHaveLength(2);
    expect(result.preview?.warnings.join(' ')).toContain('descontos');
  });

  it.each([{}, { text: '' }, { text: 123 }, { qrCodeText: 'https://exemplo.com' }])('rejeita entrada sem texto OCR: %j', async (body) => {
    await request(app).post('/api/notas-fiscais/preview').send(body).expect(400);
  });

  it('limita o tamanho do texto', async () => {
    await request(app).post('/api/notas-fiscais/preview').send({ text: 'a'.repeat(100_001) }).expect(400);
  });
});
