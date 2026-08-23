import { Router } from 'express';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';
import {
  getGoogleOAuthClientId,
  isGoogleSignupOAuthConfigured,
  verifyGoogleSignupIdToken,
} from './signupOAuthGoogle.service.js';

const router = Router();

function handleOAuthError(e: unknown, res: import('express').Response) {
  if (e instanceof AuthSignupOAuthError) {
    res.status(e.statusCode).json({ error: e.message });
    return;
  }
  const msg = e instanceof Error ? e.message : '처리에 실패했습니다.';
  res.status(400).json({ error: msg });
}

/** GET /api/public/auth-signup/oauth/google/config */
router.get('/oauth/google/config', (_req, res) => {
  res.json({
    enabled: isGoogleSignupOAuthConfigured(),
    clientId: getGoogleOAuthClientId(),
  });
});

/** POST /api/public/auth-signup/oauth/google/verify */
router.post('/oauth/google/verify', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const idToken = typeof body.idToken === 'string' ? body.idToken : '';
    const result = await verifyGoogleSignupIdToken(idToken);
    res.json(result);
  } catch (e) {
    handleOAuthError(e, res);
  }
});

export default router;
