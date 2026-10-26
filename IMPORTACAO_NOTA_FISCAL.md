# Importacao de nota fiscal por foto

O fluxo usa Tesseract.js com o modelo de portugues. E gratuito, sem conta, chave ou API paga. Os arquivos do leitor sao servidos pela propria aplicacao, inclusive em producao no Render.

1. Em **Fotografar nota**, escolha **Tirar foto da nota** para abrir a camera traseira no celular, ou selecione uma foto da galeria.
2. Fotografe o papel plano, na orientacao correta, com boa iluminacao e todas as colunas de itens e precos visiveis. Formatos: JPG, PNG ou WebP; limite de 20 MB. Converta HEIC para JPG se necessario.
3. O navegador le o texto localmente e envia somente o texto para `POST /api/notas-fiscais/preview` (`{ "text": "..." }`). A imagem fica na memoria do navegador enquanto o dialogo estiver aberto.
4. O servidor identifica linhas de produtos, quantidades, precos, estabelecimento, data e total. Remove codigos de produto/fiscais e expande abreviacoes conhecidas. Marca e embalagem sao preservadas.
5. Confira os itens com a foto. Edite nomes, categorias, quantidades e precos unitarios. Tambem e possivel corrigir o texto reconhecido e gerar os itens novamente.
6. Confirme **Importar como compra** para gravar os itens e atualizar o dashboard.

## Valores e limites

- O ultimo valor da linha e interpretado como total do item; o preco unitario e calculado dividindo pela quantidade.
- O cadastro atual exige quantidades inteiras. Itens por peso/volume ficam com quantidade 1 e o valor total comprado, com aviso para revisao.
- Precos nao identificados ficam vazios e precisam ser preenchidos. Datas nao identificadas tambem precisam ser informadas.
- Descontos globais, layouts incomuns, texto inclinado ou fotos desfocadas podem exigir correcao manual. Diferencas entre a soma dos itens e o total identificado geram aviso. O parser nao interpreta todos os layouts fiscais.
- O OCR ocorre em um worker e pode levar mais tempo no primeiro uso ou em celulares antigos. Fechar o dialogo cancela a leitura.
- Nao ha garantia de que a camera abra em todos os navegadores; a selecao de arquivo continua disponivel. Use o endereco HTTPS em producao.

## Desenvolvimento e deploy

`npm run dev:client` e `npm run build:client` executam `scripts/prepare-ocr.mjs`, que copia worker, WebAssembly e modelo de portugues de `node_modules` para `public/ocr`. O Vite inclui esses arquivos no build. Nao configure chaves ou servicos adicionais no Render.

Os testes de rotas cobrem exemplos sinteticos de notas e persistencia dos produtos. A precisao em cupons reais deve ser conferida com fotos de diferentes estabelecimentos.

Referencia tecnica: [instalacao local do Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
