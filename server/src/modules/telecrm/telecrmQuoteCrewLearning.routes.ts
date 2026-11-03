import { Router } from 'express';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { predictTelecrmAiQuote } from './telecrmAiQuoteModel.service.js';
import {
  buildTelecrmAiQuoteRuleExamples,
  getTelecrmAiQuoteStatus,
  parseTelecrmAiQuoteRule,
  validateTelecrmAiQuoteRuleSpec,
} from './telecrmAiQuoteRules.service.js';
import {
  createTelecrmAiQuoteRule,
  deleteTelecrmAiQuoteRule,
  listTelecrmAiQuoteRules,
  updateTelecrmAiQuoteRule,
} from './telecrmAiQuoteRules.store.js';
import {
  backfillTelecrmQuoteCrewLearningSnapshots,
  getTelecrmPropertyChoiceOptions,
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

/** 접수란 건축물 유형·건물 형태 선택지 — 손님 발주서와 같은 목록 */
router.get('/property-options', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    const options = await getTelecrmPropertyChoiceOptions(tenantId);
    res.json(options);
  } catch (e) {
    console.error('[telecrm-quote-learning] property-options failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '유형 선택지를 불러올 수 없습니다.' });
  }
});

router.post('/backfill', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const limitInput = (req.body as { limit?: number } | undefined)?.limit ?? req.query.limit;
  const limitRaw = limitInput == null || limitInput === '' ? NaN : Number(limitInput);
  /** limit 미지정 → 전체 접수(500건 단위 페이지) */
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.max(50, Math.floor(limitRaw)) : null;
  try {
    const result = await backfillTelecrmQuoteCrewLearningSnapshots(tenantId, limit);
    const overview = await getTelecrmQuoteCrewLearningOverview(tenantId);
    res.json({ ...result, overview });
  } catch (e) {
    console.error('[telecrm-quote-learning] backfill failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '학습 동기화에 실패했습니다.' });
  }
});


// ── AI 견적 — 말로 넣는 규칙 · 학습 상태 · 직접 물어보기 ──

function brandOf(req: { query: Record<string, unknown>; body?: unknown }): string | null {
  const fromBody = (req.body as { operatingCompanyId?: unknown } | undefined)?.operatingCompanyId;
  const raw = typeof fromBody === 'string' ? fromBody : typeof req.query.operatingCompanyId === 'string' ? req.query.operatingCompanyId : '';
  return raw.trim() || null;
}

router.get('/ai-quote/status', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    res.json(await getTelecrmAiQuoteStatus(tenantId, brandOf(req)));
  } catch (e) {
    console.error('[telecrm-ai-quote] status failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'AI 견적 상태를 불러올 수 없습니다.' });
  }
});

router.get('/ai-quote/rules', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    res.json({ items: await listTelecrmAiQuoteRules(tenantId) });
  } catch (e) {
    console.error('[telecrm-ai-quote] rules list failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '규칙을 불러올 수 없습니다.' });
  }
});

router.post('/ai-quote/rules/parse', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const text = String((req.body as { text?: unknown } | undefined)?.text ?? '');
  try {
    res.json(await parseTelecrmAiQuoteRule(tenantId, user.userId, text, brandOf(req)));
  } catch (e) {
    console.error('[telecrm-ai-quote] rule parse failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '규칙을 알아듣지 못했어요. 다시 시도해 주세요.' });
  }
});

router.post('/ai-quote/rules', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = (req.body ?? {}) as { text?: unknown; spec?: unknown };
  const text = String(body.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: '규칙 문장이 비어 있어요.' });
    return;
  }
  try {
    const spec = await validateTelecrmAiQuoteRuleSpec(tenantId, body.spec);
    if (typeof spec === 'string') {
      res.status(400).json({ error: spec });
      return;
    }
    const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } }).catch(() => null);
    const rule = await createTelecrmAiQuoteRule(tenantId, {
      text,
      spec,
      createdById: user.userId,
      createdByName: me?.name?.trim() || null,
    });
    // 저장 직후 실제로 바뀐 금액 — 「배웠어요」 확인용
    const [examples, status] = await Promise.all([
      buildTelecrmAiQuoteRuleExamples(tenantId, spec, brandOf(req), 'add'),
      getTelecrmAiQuoteStatus(tenantId, brandOf(req)),
    ]);
    res.status(201).json({ rule, examples, status });
  } catch (e) {
    console.error('[telecrm-ai-quote] rule save failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '규칙을 저장하지 못했어요.' });
  }
});

router.patch('/ai-quote/rules/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const body = (req.body ?? {}) as { isActive?: unknown; sortOrder?: unknown };
  try {
    const rule = await updateTelecrmAiQuoteRule(tenantId, String(req.params.id), {
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
    });
    if (!rule) {
      res.status(404).json({ error: '규칙을 찾을 수 없어요.' });
      return;
    }
    res.json({ rule, status: await getTelecrmAiQuoteStatus(tenantId, brandOf(req)) });
  } catch (e) {
    console.error('[telecrm-ai-quote] rule update failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '규칙을 바꾸지 못했어요.' });
  }
});

router.delete('/ai-quote/rules/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    const ok = await deleteTelecrmAiQuoteRule(tenantId, String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: '규칙을 찾을 수 없어요.' });
      return;
    }
    res.json({ ok: true, status: await getTelecrmAiQuoteStatus(tenantId, brandOf(req)) });
  } catch (e) {
    console.error('[telecrm-ai-quote] rule delete failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '규칙을 지우지 못했어요.' });
  }
});

/** 직접 물어보기 — 조건을 넣으면 지금 AI 견적이 얼마로 계산하는지 */
router.post('/ai-quote/preview', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
  const pyeong = Number(b.pyeong);
  if (!Number.isFinite(pyeong) || pyeong <= 0) {
    res.status(400).json({ error: '평수를 넣어 주세요.' });
    return;
  }
  try {
    const quote = await predictTelecrmAiQuote(tenantId, {
      operatingCompanyId: brandOf(req),
      areaPyeong: pyeong,
      propertyType: typeof b.propertyType === 'string' ? b.propertyType : null,
      isOneRoom: b.isOneRoom === true,
      roomCount: num(b.roomCount),
      bathroomCount: num(b.bathroomCount),
      balconyCount: num(b.balconyCount),
    });
    res.json({ quote });
  } catch (e) {
    console.error('[telecrm-ai-quote] preview failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'AI 견적을 계산하지 못했어요.' });
  }
});

export const telecrmQuoteCrewLearningRouter = router;
