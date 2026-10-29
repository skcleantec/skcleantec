import { Router } from 'express';
import { findPublicReceipt } from './receiptCopy.service.js';

const router = Router();

router.get('/:token', async (req, res) => {
  const found = await findPublicReceipt(String(req.params.token ?? ''));
  if (!found) {
    res.status(404).json({ error: '영수증을 찾을 수 없습니다.' });
    return;
  }
  res.json(found.doc);
});

router.get('/:token/:file', async (req, res) => {
  const file = String(req.params.file ?? '');
  if (file !== 'png' && file !== 'pdf') {
    res.status(404).json({ error: '영수증을 찾을 수 없습니다.' });
    return;
  }
  const found = await findPublicReceipt(String(req.params.token ?? ''));
  const url = file === 'png' ? found?.pngUrl : found?.pdfUrl;
  if (!found || !url) {
    res.status(404).json({ error: '영수증을 찾을 수 없습니다.' });
    return;
  }
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(404).json({ error: '영수증을 찾을 수 없습니다.' });
      return;
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', file === 'png' ? 'image/png' : 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Content-Disposition', `inline; filename="receipt.${file}"`);
    res.send(body);
  } catch {
    res.status(404).json({ error: '영수증을 찾을 수 없습니다.' });
  }
});

export default router;
