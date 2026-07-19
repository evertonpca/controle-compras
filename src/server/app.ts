import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { ProductRepository } from './repositories/productRepository.js';
import { createProductRouter } from './routes/productRoutes.js';
import { createReceiptRouter } from './routes/receiptRoutes.js';

interface CreateAppOptions {
  productRepository: ProductRepository;
}

export function createApp({ productRepository }: CreateAppOptions): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/api/produtos', createProductRouter(productRepository));
  app.use('/api/notas-fiscais', createReceiptRouter());

  const clientDistPath = path.join(process.cwd(), 'dist', 'client');
  app.use(express.static(clientDistPath));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ erro: 'Ocorreu um erro interno.' });
  };
  app.use(errorHandler);

  return app;
}
