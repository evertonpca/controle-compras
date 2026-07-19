import { Router } from 'express';
import { ProductRepository } from '../repositories/productRepository.js';
import { validateProduct } from '../services/productValidation.js';

export function createProductRouter(repository: ProductRepository): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const busca = String(req.query.busca ?? '');
    res.json(repository.list(busca));
  });

  router.post('/', (req, res) => {
    const result = validateProduct(req.body);
    if ('error' in result) return res.status(400).json({ erro: result.error });

    return res.status(201).json(repository.create(result.product));
  });

  router.put('/:id', (req, res) => {
    const result = validateProduct(req.body);
    if ('error' in result) return res.status(400).json({ erro: result.error });

    const updated = repository.update(Number(req.params.id), result.product);
    if (!updated) return res.status(404).json({ erro: 'Produto não encontrado.' });

    return res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const deleted = repository.delete(Number(req.params.id));
    if (!deleted) return res.status(404).json({ erro: 'Produto não encontrado.' });

    return res.status(204).end();
  });

  return router;
}
