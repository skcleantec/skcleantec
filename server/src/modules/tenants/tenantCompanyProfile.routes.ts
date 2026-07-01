import { Router } from 'express';
import { formatSmtpSendError } from '../../lib/tenantSmtp.service.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { tenantCompanySealFolder } from '../../lib/quotationSeal.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireTenantIdFromAuth } from './tenantScope.helpers.js';
import {
  getTenantCompanyProfile,
  patchTenantCompanyProfile,
  sendTenantCompanyProfileTestEmail,
  type TenantCompanyProfilePatch,
} from './tenantCompanyProfile.service.js';

const router = Router();

router.use(authMiddleware, requireStaffPermission('admin.companyProfile'));

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
    if (err.code === 'not_found') {
      res.status(404).json({ error: err.message ?? '영업 브랜드를 찾을 수 없습니다.' });
      return;
    }
    if (err.code === 'bad_request') {
      res.status(400).json({
        error: err.message ?? '요청을 처리할 수 없습니다.',
      });
      return;
    }
    throw e;
  }
});

/** POST /api/admin/tenant-company-profile/seal-upload-sign */
router.post('/seal-upload-sign', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: '이미지 저장소가 준비되지 않았습니다.' });
      return;
    }
    const folder = tenantCompanySealFolder(tenantId);
    const ts = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = { timestamp: ts, folder };
    const cfg = cloudinary.config();
    if (!cfg.api_secret) {
      res.status(503).json({ error: '저장 설정이 불완전합니다.' });
      return;
    }
    const signature = cloudinary.utils.api_sign_request(paramsToSign, cfg.api_secret);
    res.json({
      cloudName: cfg.cloud_name,
      apiKey: cfg.api_key,
      timestamp: ts,
      signature,
      folder,
    });
  } catch (e) {
    console.error('[tenant-company-profile] seal upload-sign', e);
    res.status(500).json({ error: '업로드 서명에 실패했습니다.' });
  }
});

/** POST /api/admin/tenant-company-profile/test-email */
router.post('/test-email', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const to = typeof req.body?.to === 'string' ? req.body.to : '';
  const operatingCompanyId =
    typeof req.body?.operatingCompanyId === 'string' ? req.body.operatingCompanyId : null;
  try {
    await sendTenantCompanyProfileTestEmail(tenantId, to, operatingCompanyId);
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
