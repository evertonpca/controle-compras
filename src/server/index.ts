import { createApp } from './app.js';
import { createDatabase } from './database.js';
import { ProductRepository } from './repositories/productRepository.js';

const port = Number(process.env.PORT ?? 3000);
const database = createDatabase();
const app = createApp({ productRepository: new ProductRepository(database) });

app.listen(port, () => {
  console.log(`Sistema disponível em http://localhost:${port}`);
});
