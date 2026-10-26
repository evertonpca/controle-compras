# Controle de produtos

CRUD local de produtos refatorado para React, Node.js com Express, TypeScript e Tailwind CSS.

## Como executar

```powershell
npm install
npm run dev
```

- Frontend: `https://localhost:5173` (certificado local de desenvolvimento)
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

## Publicar no Render com Neon

O backend usa PostgreSQL quando `DATABASE_URL` está definida e cria a tabela automaticamente antes de iniciar. Sem essa variável, usa SQLite apenas em desenvolvimento. Em produção, a ausência de `DATABASE_URL` impede a inicialização para evitar perda de dados no disco temporário do Render.

1. No Neon, crie um projeto Free chamado `controle-compras`. Em **Connect**, copie a connection string PostgreSQL completa, com os parâmetros de SSL. A opção de conexão com pooling pode ser usada.
2. Envie este código (incluindo `render.yaml` e `package-lock.json`) para o GitHub.
3. No Render, clique em **New > Blueprint**, conecte o repositório e selecione a branch com estas alterações.
4. O Render lê `render.yaml`, que configura um único Web Service no plano **Free**, para frontend e API juntos. Informe `DATABASE_URL` com a URL do Neon quando solicitado e confira o plano Free antes de criar os recursos.
5. Depois do deploy, abra a URL HTTPS exibida pelo Render. Cadastre uma compra, reinicie o serviço e confira que ela continua salva.

Se preferir **New > Web Service**, preencha:

| Campo | Valor |
| --- | --- |
| Runtime | Node |
| Root Directory | Vazio |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/api/produtos` |
| Environment: NODE_VERSION | `24.22.1` |
| Environment: NODE_ENV | `production` |
| Environment: DATABASE_URL | URL PostgreSQL completa do Neon |

Não crie um banco no Render: o banco fica no Neon. Não é necessário publicar o frontend separadamente, nem configurar uma URL de API no cliente. O Express usa a porta fornecida pelo Render em `PORT`.

A URL do banco é segredo: configure-a somente no backend, sem prefixo `VITE_`, e não a envie para o GitHub. A aplicação atual não possui login: qualquer pessoa com acesso ao site pode consultar e alterar as compras. Os registros do SQLite local não são transferidos automaticamente para o Neon.

O serviço Free do Render dorme após 15 minutos sem tráfego e pode levar cerca de um minuto para voltar. O HTTPS público é gerenciado pelo Render, inclusive para uso da câmera no celular. Os limites gratuitos podem mudar; consulte https://render.com/docs/free e https://neon.com/pricing.

Para testar PostgreSQL localmente no PowerShell:

```powershell
$env:DATABASE_URL = 'COLE_AQUI_A_URL_DO_NEON'
npm run dev
```

O backend carrega `.env.local` e `.env` automaticamente. Variáveis já definidas no processo (por exemplo, pelo Render) têm prioridade, seguidas por `.env.local` e `.env`. `DATABASE_URL` é usada pelo pool da aplicação; quando disponível, `DATABASE_URL_UNPOOLED` é usada para inicializar o schema pela conexão direta. Credenciais ficam apenas no backend.

### Configuração pelo Neon CLI

```powershell
neon login
neon init -y --org-id org-bold-hall-84446658 --project-id ancient-base-07975314 --branch production --services postgres
neon deploy
npm run build
npm run test:neon
```

O CLI mantém o vínculo local em `.neon` (ignorado pelo Git) e as credenciais em `.env.local` ou no `.env` existente. `neon.ts` declara apenas PostgreSQL; Auth permanece desabilitado. O servidor Express continua hospedado no Render, que precisa receber `DATABASE_URL` e, se disponível, `DATABASE_URL_UNPOOLED` nas variáveis de ambiente.

`npm test` executa os testes locais, incluindo PostgreSQL emulado (`pg-mem`). `npm run test:neon` exige o build e uma conexão real: inicia o backend compilado, verifica a interface, cria/atualiza uma compra, confirma a gravação diretamente no PostgreSQL, reinicia o backend e verifica persistência, depois remove apenas o registro criado pelo teste. Esse comando usa o banco apontado pelas variáveis locais.
