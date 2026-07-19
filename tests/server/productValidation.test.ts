import { describe, expect, it } from 'vitest';
import { validateProduct } from '../../src/server/services/productValidation.js';

describe('validateProduct', () => {
  it('normaliza um produto válido', () => {
    const result = validateProduct({
      nome: '  Teclado  ',
      estabelecimento: ' Loja Centro ',
      categoria: 'Periféricos',
      preco: '199.90',
      estoque: '5',
      ativo: false,
      data_compra: '2026-07-19'
    });

    expect(result).toEqual({
      product: {
        nome: 'Teclado',
        estabelecimento: 'Loja Centro',
        categoria: 'Periféricos',
        preco: 199.9,
        estoque: 5,
        ativo: 0,
        data_compra: '2026-07-19',
        purchase_id: ''
      }
    });
  });

  it('rejeita dados inválidos', () => {
    expect(validateProduct({ nome: '', preco: 10, estoque: 1 })).toEqual({
      error: 'O nome do produto é obrigatório.'
    });
    expect(validateProduct({ nome: 'Mouse', preco: -1, estoque: 1 })).toEqual({
      error: 'Informe um preço válido.'
    });
    expect(validateProduct({ nome: 'Mouse', preco: 10, estoque: 1.5 })).toEqual({
      error: 'Informe um estoque inteiro e não negativo.'
    });
  });
});
