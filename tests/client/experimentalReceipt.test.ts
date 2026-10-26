import { describe, expect, it } from 'vitest';
import { parseExperimentalReceipt } from '../../src/client/services/experimentalReceipt.js';

describe('resposta de IA para nota fiscal', () => {
  it('preserva linhas repetidas, valores pagos por peso e preços zero', () => {
    expect(parseExperimentalReceipt(JSON.stringify({ itens: [
      { nome: ' Banana KG ', preco: 3.47 }, { nome: 'Leite', preco: 10 },
      { nome: 'Leite', preco: 5 }, { nome: 'Brinde', preco: 0 }
    ] }))).toEqual([
      { nome: 'Banana KG', preco: 3.47 }, { nome: 'Leite', preco: 10 },
      { nome: 'Leite', preco: 5 }, { nome: 'Brinde', preco: 0 }
    ]);
  });

  it('aceita bloco JSON de Markdown e arredondamento binário normal', () => {
    expect(parseExperimentalReceipt('```json\n{"itens":[{"nome":"Arroz","preco":25.90}]}\n```'))
      .toEqual([{ nome: 'Arroz', preco: 25.9 }]);
    expect(parseExperimentalReceipt('{"itens":[{"nome":"X","preco":0.29}]}')[0].preco).toBe(0.29);
  });

  it.each([
    '', 'Aqui está: {"itens":[]}', 'null', '[]', '{}', '{"itens":[]}',
    '{"itens":[{"nome":"Produto","preco":"5,90"}]}',
    '{"itens":[{"nome":"Produto","preco":null}]}',
    '{"itens":[{"nome":"Produto","preco":-1}]}',
    '{"itens":[{"nome":"Produto","preco":1.234}]}',
    '{"itens":[{"nome":"Produto","preco":1e309}]}',
    '{"itens":[{"nome":" ","preco":1}]}',
    '{"itens":[{"nome":"Produto","preco":1,"quantidade":2}]}',
    '{"itens":[{"nome":"Produto","preco":1}],"total":1}',
    '{"itens":[{"nome":"Produto","preco":1},null]}'
  ])('rejeita resposta inválida sem importar parte dela: %s', (text) => {
    expect(() => parseExperimentalReceipt(text)).toThrow();
  });
});
