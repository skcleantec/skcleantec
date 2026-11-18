import { Router } from 'express';
import { openTaxInvoiceShare } from './taxInvoiceShare.service.js';

const router = Router();

function page(message: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>영수증</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;font-family:sans-serif"><p style="margin:0;font-size:16px">${message}</p></body></html>`;
}

router.get('/:token', async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'private, no-store');
  const opened = await openTaxInvoiceShare(String(req.params.token ?? ''));
  if (opened.kind === 'cancelled') {
    res.status(200).type('html').send(page('취소된 영수증입니다'));
    return;
  }
  if (opened.kind === 'go') {
    res.redirect(302, opened.url);
    return;
  }
  res.status(404).type('html').send(page('영수증을 찾을 수 없습니다.'));
});

export default router;
