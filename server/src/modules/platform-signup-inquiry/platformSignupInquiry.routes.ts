import { Router } from 'express';
import type { PlatformSignupInquiryStatus } from '@prisma/client';
import { platformAuthMiddleware, platformSuperAdminOnly } from '../platform/platformAuth.middleware.js';
import {
  listPlatformSignupInquiries,
  patchPlatformSignupInquiryNote,
  PlatformSignupInquiryError,
  updatePlatformSignupInquiryStatus,
} from './platformSignupInquiry.service.js';
import {
  getPlatformSignupInquirySettings,
  updatePlatformSignupInquirySettings,
} from './platformSignupInquiry.settings.service.js';

const router = Router();
router.use(platformAuthMiddleware);
router.use(platformSuperAdminOnly);

const STATUS_SET = new Set<PlatformSignupInquiryStatus>([
  'PENDING',
  'CONTACTED',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
  'CLOSED',
]);

/** GET /api/platform/signup-inquiries?status=PENDING&limit=30&offset=0 */
router.get('/', async (req, res) => {
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
  const status =
    statusRaw && STATUS_SET.has(statusRaw as PlatformSignupInquiryStatus)
      ? (statusRaw as PlatformSignupInquiryStatus)
      : undefined;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  try {
    const data = await listPlatformSignupInquiries({ status, limit, offset });
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/settings', async (_req, res) => {
  res.json(await getPlatformSignupInquirySettings());
});

router.patch('/settings', async (req, res) => {
  const body = req.body as {
    notifyEmails?: string[];
    replyToEmail?: string | null;
    isActive?: boolean;
  };
  try {
    const updated = await updatePlatformSignupInquirySettings(body);
    res.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'NOTIFY_EMAILS_REQUIRED') {
      res.status(400).json({ error: '알림 수신 이메일을 1개 이상 등록해 주세요.' });
      return;
    }
    if (msg === 'INVALID_REPLY_TO_EMAIL') {
      res.status(400).json({ error: '회신 이메일 형식을 확인해 주세요.' });
      return;
    }
    console.error('[platform signup-inquiry] patch settings', e);
    res.status(500).json({ error: '저장에 실패했습니다.' });
  }
});

router.post('/:id/status', async (req, res) => {
  const auth = req as unknown as { platformUser: { platformUserId: string } };
  const body = req.body as {
    status?: PlatformSignupInquiryStatus;
    adminNote?: string | null;
    convertedTenantId?: string | null;
  };
  if (!body.status || !STATUS_SET.has(body.status)) {
    res.status(400).json({ error: '상태 값을 확인해 주세요.' });
    return;
  }
  try {
    const result = await updatePlatformSignupInquiryStatus({
      inquiryId: req.params.id,
      status: body.status,
      platformUserId: auth.platformUser.platformUserId,
      adminNote: body.adminNote,
      convertedTenantId: body.convertedTenantId,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof PlatformSignupInquiryError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '처리에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.patch('/:id', async (req, res) => {
  const body = req.body as { adminNote?: string | null };
  try {
    const result = await patchPlatformSignupInquiryNote({
      inquiryId: req.params.id,
      adminNote: body.adminNote ?? null,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof PlatformSignupInquiryError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    res.status(400).json({ error: '저장에 실패했습니다.' });
  }
});

export default router;
