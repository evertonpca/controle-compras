# Controle de produtos

CRUD local de produtos refatorado para React, Node.js com Express, TypeScript e Tailwind CSS.

## Como executar

```powershell
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3000`
- Banco local: `data/produtos.db`, criado automaticamente.

## Comandos úteis

- `npm run dev`: sobe React/Vite e Express juntos.
- `npm run dev:client`: sobe apenas o frontend.
- `npm run dev:server`: sobe apenas o backend com reload.
- `npm run build`: gera a versão de produção em `dist/`.
- `npm start`: executa a versão gerada pelo build.
- `npm test`: roda os testes uma vez.
- `npm run test:watch`: roda os testes em modo observação.
- `npm run typecheck`: valida os tipos do frontend e do backend.

## Estrutura

```text
src/
  client/
    components/        Componentes React reutilizáveis
    services/          Chamadas HTTP para a API
    styles/            Entrada do Tailwind CSS
    App.tsx            Tela principal
    main.tsx           Entrada do React
  server/
    repositories/      Acesso ao SQLite
    routes/            Rotas HTTP do Express
    services/          Regras/validações de negócio
    app.ts             Configuração do Express
    database.ts        Inicialização do banco
    index.ts           Entrada do servidor
  shared/
    product.ts         Tipos compartilhados entre cliente e servidor
tests/
  server/              Testes simples da API e validações
```

## O que você deve saber

O projeto usa Vite para servir e compilar o React. Em desenvolvimento, o Vite roda na porta `5173` e redireciona chamadas `/api` para o Express na porta `3000`.

Os estilos da interface ficam em classes Tailwind dentro dos componentes. O arquivo `src/client/styles/tailwind.css` existe apenas como entrada do Tailwind.

O backend foi separado em arquivos pequenos para crescer sem virar bagunça: rotas recebem requisições, serviços validam dados e repositórios conversam com o banco. O arquivo `src/server/app.ts` não inicia porta nenhuma, então ele pode ser importado nos testes.

Os tipos principais ficam em `src/shared/product.ts`. Quando o contrato de produto mudar, atualize esse arquivo primeiro e depois ajuste cliente, servidor e testes.

O campo antigo de descrição foi substituído por `estabelecimento`. O campo `data_compra` pode ficar vazio; nesse caso, a UI mostra a data de hoje na tabela sem gravar esse valor automaticamente no banco.

Para produção, rode `npm run build` e depois `npm start`. O Express passa a servir os arquivos estáticos gerados pelo Vite em `dist/client`.
