import { Router } from 'express';
import { WalletChargeConfirmTokenError } from './walletChargeConfirmToken.js';
import { confirmWalletChargeByEmailToken, previewWalletChargeConfirm } from './walletChargeConfirm.service.js';

const router = Router();

function readToken(req: { query: unknown; body: unknown }): string {
  const q = req.query as { token?: unknown; t?: unknown };
  const b = req.body as { token?: unknown };
  const fromQuery =
    typeof q.token === 'string' ? q.token : typeof q.t === 'string' ? q.t : '';
  const fromBody = typeof b.token === 'string' ? b.token : '';
  return (fromBody || fromQuery).trim();
}

function sendError(res: import('express').Response, e: unknown) {
  if (e instanceof WalletChargeConfirmTokenError) {
    res.status(e.statusCode).json({ error: e.message });
    return;
  }
  const msg = e instanceof Error ? e.message : '처리할 수 없습니다.';
  const status = msg.includes('찾을 수 없') ? 404 : 400;
  res.status(status).json({ error: msg });
}

/** GET /api/public/wallet/charge-confirm?token= — 미리보기만 (부작용 없음) */
router.get('/', async (req, res) => {
  try {
    const token = readToken(req);
    const preview = await previewWalletChargeConfirm(token);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.json(preview);
  } catch (e) {
    sendError(res, e);
  }
});

/** POST /api/public/wallet/charge-confirm — 입금 확인 + 지갑 충전 */
router.post('/', async (req, res) => {
  try {
    const token = readToken(req);
    const result = await confirmWalletChargeByEmailToken(token);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (e) {
    sendError(res, e);
  }
});

export default router;
