export interface Product {
  id: number;
  nome: string;
  estabelecimento: string;
  categoria: string;
  preco: number;
  estoque: number;
  ativo: number;
  data_compra: string;
  purchase_id: string;
  criado_em: string;
}

export interface ProductInput {
  nome: string;
  estabelecimento: string;
  categoria: string;
  preco: number;
  estoque: number;
  ativo: boolean | number;
  data_compra: string;
  purchase_id?: string;
}

export interface NormalizedProductInput {
  nome: string;
  estabelecimento: string;
  categoria: string;
  preco: number;
  estoque: number;
  ativo: 0 | 1;
  data_compra: string;
  purchase_id: string;
}
