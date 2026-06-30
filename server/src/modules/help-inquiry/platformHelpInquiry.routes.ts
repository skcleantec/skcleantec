import { Router } from 'express';
import { platformAuthMiddleware, platformSuperAdminOnly } from '../platform/platformAuth.middleware.js';
import {
  getHelpInquirySettings,
  updateHelpInquirySettings,
} from './helpInquirySettings.service.js';
import { listHelpInquiryPosts } from './helpInquiryPost.service.js';
import type { HelpInquiryCategory } from './helpInquiry.types.js';

const router = Router();
router.use(platformAuthMiddleware);
router.use(platformSuperAdminOnly);

router.get('/settings', async (_req, res) => {
  res.json(await getHelpInquirySettings());
});

router.patch('/settings', async (req, res) => {
  const body = req.body as {
    contactEmail?: string;
    notifyEmail?: string;
    composeHelpText?: string | null;
    categories?: HelpInquiryCategory[];
  };
  try {
    const updated = await updateHelpInquirySettings(body);
    res.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'INVALID_CONTACT_EMAIL' || msg === 'INVALID_NOTIFY_EMAIL') {
      res.status(400).json({ error: '이메일 형식을 확인해 주세요.' });
      return;
    }
    if (msg === 'CATEGORIES_REQUIRED') {
      res.status(400).json({ error: '카테고리를 1개 이상 등록해 주세요.' });
      return;
    }
    console.error('[platform help-inquiry] patch settings', e);
    res.status(500).json({ error: '저장에 실패했습니다.' });
  }
});

router.get('/posts', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  res.json(await listHelpInquiryPosts({ limit, offset }));
});

export default router;
