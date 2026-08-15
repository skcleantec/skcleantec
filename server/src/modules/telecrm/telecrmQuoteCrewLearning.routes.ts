import { Router } from 'express';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';
import {
  backfillTelecrmQuoteCrewLearningSnapshots,
  getTelecrmQuoteCrewLearningHints,
  getTelecrmQuoteCrewLearningOverview,
} from './telecrmQuoteCrewLearning.service.js';

const router = Router();

router.get('/overview', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    const overview = await getTelecrmQuoteCrewLearningOverview(tenantId);
    res.json(overview);
  } catch (e) {
    console.error('[telecrm-quote-learning] overview failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '학습 현황을 불러올 수 없습니다.' });
  }
});

router.get('/hints', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    const hints = await getTelecrmQuoteCrewLearningHints(tenantId, req.query as Record<string, unknown>);
    res.json(hints);
  } catch (e) {
    console.error('[telecrm-quote-learning] hints failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '학습 힌트를 불러올 수 없습니다.' });
  }
});

router.post('/backfill', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const limitRaw = Number((req.body as { limit?: number } | undefined)?.limit ?? req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(2000, Math.max(50, limitRaw)) : 500;
  try {
    const result = await backfillTelecrmQuoteCrewLearningSnapshots(tenantId, limit);
    const overview = await getTelecrmQuoteCrewLearningOverview(tenantId);
    res.json({ ...result, overview });
  } catch (e) {
    console.error('[telecrm-quote-learning] backfill failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '학습 동기화에 실패했습니다.' });
  }
});

export const telecrmQuoteCrewLearningRouter = router;
