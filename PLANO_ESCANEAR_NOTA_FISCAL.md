# Plano: escanear nota fiscal de compra pelo celular

## Objetivo

Adicionar uma feature para escanear o QR Code da NFC-e/cupom fiscal pelo celular e importar automaticamente uma compra completa para o sistema.

A nova estrutura do produto deve considerar:

- a pagina principal como dashboard de gastos;
- a rota `/compras` para cadastrar e visualizar compras;
- cada compra como um conjunto de itens;
- os indicadores do dashboard calculados a partir do historico de compras.

## Premissas

- No Brasil, o fluxo principal deve ler o QR Code da NFC-e, pois ele representa a compra inteira.
- A leitura de codigo de barras de produto individual nao atende ao objetivo principal.
- A extracao da SEFAZ pode falhar por captcha, bloqueio, estado sem parser, layout diferente ou nota antiga.
- O usuario sempre deve revisar os dados antes de salvar.
- OCR de foto da nota deve ser fallback, nao fluxo principal.
- A versao atual da aplicacao ainda persiste itens na tabela `produtos`; a evolucao recomendada e criar tabelas reais de `compras` e `itens_compra`.

## Estrutura alvo da aplicacao

### Dashboard (`/`)

Indicadores principais:

- total gasto no mes atual;
- quantidade de compras do mes;
- ticket medio;
- gasto por estabelecimento;
- gasto por categoria;
- maior item/gasto do mes;
- ultima compra registrada;
- evolucao mensal, em uma fase posterior.

### Compras (`/compras`)

Funcionalidades:

- cadastrar compra manualmente;
- visualizar compras agrupadas por data e estabelecimento;
- ver itens de cada compra;
- editar ou excluir item;
- pesquisar por produto, estabelecimento ou categoria;
- iniciar fluxo "Escanear nota".

## Modelo de dados recomendado

Criar tabelas especificas para separar historico de compras de cadastro/estoque.

### `compras`

- `id`
- `estabelecimento`
- `cnpj`
- `data_compra`
- `valor_total`
- `chave_acesso`
- `url_consulta`
- `origem` (`manual`, `nfce-qrcode`, `ocr`)
- `criado_em`

### `itens_compra`

- `id`
- `compra_id`
- `nome`
- `codigo`
- `ean`
- `categoria`
- `quantidade`
- `unidade`
- `preco_unitario`
- `preco_total`
- `ativo`
- `criado_em`

### Relacao com `produtos`

Curto prazo:

- manter compatibilidade salvando cada item confirmado tambem como registro de produto;
- usar `estabelecimento`, `categoria`, `preco`, `estoque` e `data_compra` para alimentar o dashboard.

Medio prazo:

- usar `compras` e `itens_compra` como fonte do historico;
- deixar `produtos` apenas para cadastro recorrente, lista de favoritos ou controle de estoque;
- permitir transformar itens de compra em produtos cadastrados quando fizer sentido.

## Fluxo esperado

1. Usuario entra em `/compras`.
2. Usuario toca em "Escanear nota".
3. A camera abre no celular.
4. O frontend detecta o QR Code da NFC-e.
5. O backend recebe o texto/URL lido.
6. O backend valida a origem e tenta montar um preview.
7. A aplicacao mostra a revisao com estabelecimento, data, total e itens.
8. Usuario corrige nomes, quantidades, precos e categorias.
9. Usuario confirma.
10. Backend salva a compra e seus itens em transacao.
11. Dashboard passa a refletir automaticamente os novos gastos.

## Fase 1: preparar dominio de compras

### Backend

- Criar tipos compartilhados em `src/shared/purchase.ts`.
- Criar `purchaseRepository.ts` com `compras` e `itens_compra`.
- Criar `purchaseValidation.ts`.
- Criar rotas:
  - `GET /api/compras`;
  - `GET /api/compras/:id`;
  - `POST /api/compras`;
  - `PUT /api/compras/:id`;
  - `DELETE /api/compras/:id`.
- Usar transacao para salvar compra e itens juntos.

### Frontend

- Fazer o dashboard consumir compras reais.
- Fazer `/compras` listar compras reais.
- Manter cadastro manual de compra com varios itens.
- Remover a dependencia conceitual de "produto = compra" da UI.

## Fase 2: prototipo do scanner de QR Code

### Frontend

- Adicionar acao "Escanear nota" na rota `/compras`.
- Criar `ReceiptScanner`.
- Usar `@zxing/browser` como opcao principal.
- Usar `BarcodeDetector API` como melhoria progressiva quando disponivel.
- Pedir permissao de camera somente quando o usuario iniciar o scan.
- Exibir estados:
  - aguardando permissao;
  - camera ativa;
  - QR Code detectado;
  - leitura invalida;
  - erro de permissao/camera.
- Parar o stream ao fechar a tela/modal.

### Backend

- Criar rota:
  - `POST /api/notas-fiscais/preview`
- Payload:

```json
{
  "qrCodeText": "https://..."
}
```

- Validar URL ou chave de acesso.
- Retornar preview normalizado, mesmo que mockado na primeira iteracao.

## Fase 3: preview normalizado

Formato sugerido:

```ts
interface ReceiptPreview {
  source: 'nfce-qrcode' | 'ocr' | 'manual';
  accessKey?: string;
  queryUrl?: string;
  merchant: {
    name: string;
    cnpj?: string;
  };
  purchase: {
    date?: string;
    total?: number;
  };
  items: Array<{
    name: string;
    code?: string;
    ean?: string;
    category?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    totalPrice: number;
    confidence: number;
  }>;
  warnings: string[];
}
```

## Fase 4: extracao da NFC-e

- Receber a URL do QR Code no backend.
- Identificar portal/estado pelo dominio.
- Criar providers por origem:
  - `receiptProviders/spProvider.ts`;
  - `receiptProviders/mgProvider.ts`;
  - `receiptProviders/genericHtmlProvider.ts`.
- Comecar com provider generico.
- Adicionar providers reais conforme notas forem testadas.
- Normalizar estabelecimento, CNPJ, data, valor total e itens.

## Fase 5: revisao antes de salvar

Criar `ReceiptReview` integrado a `/compras`.

Funcionalidades:

- editar estabelecimento;
- editar data da compra;
- editar nome do item;
- editar quantidade;
- editar preco unitario/total;
- editar categoria;
- remover item;
- ver alertas de baixa confianca;
- confirmar importacao;
- cancelar sem salvar.

## Fase 6: salvar importacao

Criar rota:

- `POST /api/notas-fiscais/importar`

Ela deve receber o preview revisado e persistir:

- compra;
- itens da compra;
- metadados fiscais;
- origem `nfce-qrcode`;
- opcionalmente produtos derivados, se essa compatibilidade ainda existir.

Usar transacao SQLite para evitar compra salva pela metade.

## Fase 7: OCR como fallback

Quando o QR Code nao puder ser lido ou a SEFAZ nao retornar itens:

1. Usuario fotografa a nota.
2. Sistema extrai texto via OCR.
3. Backend tenta identificar estabelecimento, data, total e linhas de itens.
4. Usuario revisa tudo.
5. Sistema salva como compra com origem `ocr`.

Opcoes:

- `tesseract.js` para MVP local;
- Google Vision, Azure Vision ou AWS Textract se precisar de mais precisao;
- ML Kit se o projeto virar app mobile.

## Fase 8: inteligencia historica

Melhorias futuras:

- sugestao de categoria por palavras-chave;
- lembrar correcoes feitas pelo usuario;
- detectar itens recorrentes;
- mostrar variacao de preco do mesmo item;
- comparar gasto mensal por categoria;
- destacar estabelecimentos mais frequentes;
- alertar aumento de gasto fora do padrao;
- consolidar nomes parecidos do mesmo produto.

## Arquivos provaveis

- `src/shared/purchase.ts`
- `src/shared/receipt.ts`
- `src/client/components/PurchaseDialog.tsx`
- `src/client/components/ReceiptScanner.tsx`
- `src/client/components/ReceiptReview.tsx`
- `src/client/services/purchasesApi.ts`
- `src/client/services/receiptsApi.ts`
- `src/server/repositories/purchaseRepository.ts`
- `src/server/routes/purchaseRoutes.ts`
- `src/server/routes/receiptRoutes.ts`
- `src/server/services/purchaseValidation.ts`
- `src/server/services/receiptQrParser.ts`
- `src/server/services/receiptProviders/*`
- `tests/server/purchaseRoutes.test.ts`
- `tests/server/receiptRoutes.test.ts`
- `tests/server/receiptQrParser.test.ts`

## Riscos e cuidados

- Portais da SEFAZ mudam sem aviso.
- Alguns estados podem bloquear scraping ou exigir captcha.
- A camera no navegador exige HTTPS em producao; `localhost` funciona em desenvolvimento.
- Dados fiscais e habitos de compra sao sensiveis.
- Evitar salvar imagem da nota sem necessidade.
- Sempre registrar `warnings` no preview quando houver baixa confianca.

## MVP recomendado

1. Consolidar backend de compras e itens.
2. Ajustar dashboard para consumir compras reais.
3. Criar scanner de QR Code em `/compras`.
4. Criar `POST /api/notas-fiscais/preview` com mock/preview inicial.
5. Criar tela de revisao.
6. Criar `POST /api/notas-fiscais/importar` com transacao.
7. Substituir mock por parser real de NFC-e.
8. Adicionar testes de validacao, rotas e parsing.
9. Testar camera em celular pelo Vite na rede local.
10. Adicionar OCR apenas depois que o fluxo QR Code estiver utilizavel.

## Criterios de aceite

- Dashboard mostra gasto total do mes.
- Dashboard mostra gastos por estabelecimento e categoria.
- `/compras` permite cadastrar compra com varios itens.
- Usuario consegue iniciar scan de nota pela tela de compras.
- QR Code valido gera preview revisavel.
- Usuario consegue corrigir dados antes de salvar.
- Importacao salva compra e itens sem registros parciais.
- Dashboard atualiza apos salvar compra/importacao.
- Falhas mostram mensagens claras.
- Existem testes para compras, preview, importacao e validacao principal.
