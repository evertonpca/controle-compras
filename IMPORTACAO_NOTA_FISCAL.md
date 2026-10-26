# Importacao de nota fiscal por foto

O fluxo usa Tesseract.js com o modelo de portugues. E gratuito, sem conta, chave ou API paga. Os arquivos do leitor sao servidos pela propria aplicacao, inclusive em producao no Render.

1. Em **Fotografar nota**, escolha **Tirar foto da nota** para abrir a camera traseira no celular, ou selecione uma foto da galeria.
2. Fotografe o papel plano, na orientacao correta, com boa iluminacao e todas as colunas de itens e precos visiveis. Formatos: JPG, PNG ou WebP; limite de 20 MB. Converta HEIC para JPG se necessario. Use os controles **Inicio da lista**, **Fim da lista** e, se necessario, **Ajustar laterais** para selecionar somente a tabela de produtos. Inclua as linhas de desconto. Toque em **Ler produtos**.
3. O navegador amplia o recorte e corrige o contraste local para reduzir sombras do papel antes do OCR. Le o texto localmente e envia somente o texto para `POST /api/notas-fiscais/preview` (`{ "text": "..." }`). A imagem fica na memoria do navegador enquanto o dialogo estiver aberto.
4. O servidor delimita a tabela de produtos pelo cabecalho/linhas de itens e encerra antes de totais e pagamentos. Identifica quantidades e precos mesmo com unidades coladas (como `2,304KG` e `1UN`). Remove codigos de produto/fiscais e expande abreviacoes conhecidas. Marca e embalagem sao preservadas. Estabelecimento e data podem ficar vazios se estiverem fora do recorte.
5. Confira os itens com a foto. Edite nomes, categorias, quantidades e precos unitarios. Tambem e possivel corrigir o texto reconhecido e gerar os itens novamente.
6. Confirme **Importar como compra** para gravar os itens e atualizar o dashboard.

## Valores e limites

- O ultimo valor da linha e interpretado como total do item; o preco unitario e calculado dividindo pela quantidade.
- O cadastro atual exige quantidades inteiras. Itens por peso/volume ficam com quantidade 1 e o valor total comprado. Peso e preco por kg/litro sao mostrados na revisao; o campo editavel representa o valor pago pela porcao. Esses metadados de leitura nao sao persistidos como campos novos no cadastro.
- Precos nao identificados ficam vazios e precisam ser preenchidos. Datas nao identificadas tambem precisam ser informadas.
- Linhas de desconto dentro da tabela sao associadas ao produto anterior. Porcentagens nao sao interpretadas como valores monetarios; quando disponivel, o valor liquido impresso e conferido com o desconto. Descontos globais, layouts incomuns, texto inclinado ou fotos desfocadas podem exigir correcao manual. Diferencas entre a soma dos itens e o total identificado geram aviso. O parser nao interpreta todos os layouts fiscais.
- O OCR ocorre em um worker e pode levar mais tempo no primeiro uso ou em celulares antigos. Fechar o dialogo cancela a leitura.
- Nao ha garantia de que a camera abra em todos os navegadores; a selecao de arquivo continua disponivel. Use o endereco HTTPS em producao.

## Desenvolvimento e deploy

`npm run dev:client` e `npm run build:client` executam `scripts/prepare-ocr.mjs`, que copia worker, WebAssembly e modelo de portugues de `node_modules` para `public/ocr`. O Vite inclui esses arquivos no build. Nao configure chaves ou servicos adicionais no Render.

Os testes de rotas cobrem exemplos sinteticos, uma transcricao da nota de exemplo (com dados pessoais removidos), descontos por item, unidades coladas e persistencia dos produtos. A transcricao verifica sete produtos e total de R$ 286,46. Os testes da interface verificam selecao da area, releitura e cancelamento. A precisao do OCR na fotografia original deve ser conferida separadamente, inclusive em celulares.

Referencia tecnica: [instalacao local do Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
