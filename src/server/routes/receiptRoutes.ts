import { Router } from 'express';
import { buildReceiptPreview } from '../services/receiptPreview.js';

export function createReceiptRouter(): Router {
  const router = Router();

  router.post('/preview', (req, res) => {
    const result = buildReceiptPreview(req.body?.qrCodeText);
    if ('error' in result) return res.status(400).json({ erro: result.error });

    return res.json(result.preview);
  });

  return router;
}
