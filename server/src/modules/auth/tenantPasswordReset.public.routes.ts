import { Router, type Request } from 'express';
import {
  confirmTenantPasswordReset,
  sendTenantPasswordResetCode,
  TenantPasswordResetError,
} from './tenantPasswordReset.service.js';
import { EmailVerificationError } from '../platform/emailVerification.service.js';

const router = Router();

function clientIp(req: Request): string | undefined {
  const xfRaw = req.headers['x-forwarded-for'];
  const xf = typeof xfRaw === 'string' ? xfRaw.split(',')[0]?.trim() : '';
  const raw = xf || req.socket?.remoteAddress || '';
  return raw || undefined;
}

function handleError(e: unknown, res: import('express').Response) {
  if (e instanceof TenantPasswordResetError || e instanceof EmailVerificationError) {
    res.status(e.statusCode).json({ error: e.message });
    return;
  }
  const msg = e instanceof Error ? e.message : '처리에 실패했습니다.';
  res.status(400).json({ error: msg });
}

/** POST /api/public/password-reset/send-code */
router.post('/send-code', async (req, res) => {
  const body = req.body as { tenantSlug?: string; recoveryEmail?: string };
  try {
    const result = await sendTenantPasswordResetCode({
      tenantSlug: String(body.tenantSlug ?? ''),
      recoveryEmail: String(body.recoveryEmail ?? ''),
      requestIp: clientIp(req),
    });
    res.json(result);
  } catch (e) {
    handleError(e, res);
  }
});

/** POST /api/public/password-reset/confirm */
router.post('/confirm', async (req, res) => {
  const body = req.body as {
    tenantSlug?: string;
    recoveryEmail?: string;
    challengeId?: string;
    code?: string;
    verificationCode?: string;
    newPassword?: string;
  };
  try {
    const result = await confirmTenantPasswordReset({
      tenantSlug: String(body.tenantSlug ?? ''),
      recoveryEmail: String(body.recoveryEmail ?? ''),
      challengeId: String(body.challengeId ?? ''),
      code: String(body.code ?? body.verificationCode ?? ''),
      newPassword: String(body.newPassword ?? ''),
    });
    res.json(result);
  } catch (e) {
    handleError(e, res);
  }
});

export default router;
