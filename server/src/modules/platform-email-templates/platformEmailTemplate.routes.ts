import { Router } from 'express';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
  type PlatformScopedRequest,
} from '../platform/platformAuth.middleware.js';
import { isCustomerOutboundEmailPurpose } from '../../lib/outboundEmailPurpose.js';
import { getPlatformEmailTemplateDefaults } from './platformEmailTemplate.defaults.js';
import {
  getPlatformEmailTemplate,
  listPlatformEmailTemplates,
  upsertPlatformEmailTemplate,
} from './platformEmailTemplate.service.js';
import { listPlatformEmailTemplatePurposeMeta } from './platformCustomerEmailRender.service.js';
import { buildPlatformEmailTemplatePreview } from './platformEmailTemplatePreview.service.js';
import {
  PLATFORM_EMAIL_BODY_PLACEHOLDERS,
  PLATFORM_EMAIL_SUBJECT_PLACEHOLDERS,
} from '../../lib/platformEmailTemplatePlaceholders.js';

const router = Router();

router.use(platformAuthMiddleware);

router.get('/purposes', (_req, res) => {
  res.json({
    items: listPlatformEmailTemplatePurposeMeta(),
    subjectPlaceholders: PLATFORM_EMAIL_SUBJECT_PLACEHOLDERS,
    bodyPlaceholders: PLATFORM_EMAIL_BODY_PLACEHOLDERS,
  });
});

router.get('/', async (_req, res) => {
  try {
    const items = await listPlatformEmailTemplates();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '목록 조회 실패' });
  }
});

router.get('/:purpose/preview', async (req, res) => {
  const { purpose } = req.params;
  if (!isCustomerOutboundEmailPurpose(purpose)) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  try {
    const preview = await buildPlatformEmailTemplatePreview({ purpose });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(preview.html);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '미리보기 생성 실패' });
  }
});

router.post('/:purpose/preview', async (req, res) => {
  const { purpose } = req.params;
  if (!isCustomerOutboundEmailPurpose(purpose)) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  try {
    const preview = await buildPlatformEmailTemplatePreview({
      purpose,
      override: req.body ?? {},
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(preview.html);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '미리보기 생성 실패' });
  }
});

router.get('/:purpose/brand-defaults', (req, res) => {
  const { purpose } = req.params;
  if (!isCustomerOutboundEmailPurpose(purpose)) {
    res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
    return;
  }
  res.json(getPlatformEmailTemplateDefaults(purpose));
});

router.get('/:purpose', async (req, res) => {
  try {
    const item = await getPlatformEmailTemplate(req.params.purpose);
    if (!item) {
      res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
      return;
    }
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '조회 실패' });
  }
});

router.patch('/:purpose', platformSuperAdminOnly, async (req, res) => {
  try {
    const { platformUser } = req as PlatformScopedRequest;
    const item = await upsertPlatformEmailTemplate(
      req.params.purpose,
      req.body ?? {},
      platformUser.email ?? null,
    );
    res.json(item);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '저장 실패';
    res.status(400).json({ error: msg });
  }
});

export default router;
