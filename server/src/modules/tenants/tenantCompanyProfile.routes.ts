import { Router } from 'express';
import { formatSmtpSendError } from '../../lib/tenantSmtp.service.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from './tenantScope.helpers.js';
import {
  getTenantCompanyProfile,
  patchTenantCompanyProfile,
  sendTenantCompanyProfileTestEmail,
  type TenantCompanyProfilePatch,
} from './tenantCompanyProfile.service.js';

const router = Router();

router.use(authMiddleware, adminOnly);

/** GET /api/admin/tenant-company-profile — 업체등록정보·SMTP (관리자) */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const profile = await getTenantCompanyProfile(tenantId);
  res.json(profile);
});

/** PATCH /api/admin/tenant-company-profile */
router.patch('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as TenantCompanyProfilePatch;
  try {
    const profile = await patchTenantCompanyProfile(tenantId, body);
    res.json(profile);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'bad_request') {
      res.status(400).json({
        error: err.message ?? '요청을 처리할 수 없습니다.',
      });
      return;
    }
    throw e;
  }
});

/** POST /api/admin/tenant-company-profile/test-email */
router.post('/test-email', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const to = typeof req.body?.to === 'string' ? req.body.to : '';
  try {
    await sendTenantCompanyProfileTestEmail(tenantId, to);
    res.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'bad_request') {
      res.status(400).json({ error: 'SMTP 설정을 먼저 저장해 주세요. (호스트·발신·비밀번호)' });
      return;
    }
    if (err.code === 'invalid_email') {
      res.status(400).json({ error: '테스트 수신 이메일을 올바르게 입력해 주세요.' });
      return;
    }
    console.error('[tenant-company-profile] test-email failed', e);
    res.status(500).json({ error: formatSmtpSendError(e) });
  }
});

export default router;
