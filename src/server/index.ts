import { createApp } from './app.js';
import { createStorage } from './storage.js';

const port = Number(process.env.PORT ?? 3000);
const storage = await createStorage();
const app = createApp({ productRepository: storage.repository });

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Sistema disponível em http://localhost:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void storage.close().catch(() => { process.exitCode = 1; });
    });
  });
}
