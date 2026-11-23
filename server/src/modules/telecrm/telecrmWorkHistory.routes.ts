import { Router, type Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import { kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';
import {
  isFinishOutcome,
  isLeftBy,
  isSavedKind,
  isWorkSource,
} from './telecrmWorkHistory.logic.js';
import {
  countPendingUnsaved,
  dismissWorkEntry,
  finishWorkEntry,
  getWorkEntry,
  listWorkEntries,
  patchWorkEntry,
  resumeWorkEntry,
  startWorkEntry,
  summarizeWorkEntries,
} from './telecrmWorkHistory.service.js';

const router = Router();
router.use(requireStaffPermission('crm.view'));

function actor(req: Request): AuthPayload {
  return (req as unknown as { user: AuthPayload }).user;
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function kstToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

router.post('/', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = actor(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const source = typeof body.source === 'string' ? body.source : '';
  if (!isWorkSource(source)) {
    res.status(400).json({ error: '시작 구분이 올바르지 않아요.' });
    return;
  }
  const operatingCompanyId = clip(body.operatingCompanyId, 80);
  if (operatingCompanyId) {
    const brand = await prisma.operatingCompany.findFirst({
      where: { id: operatingCompanyId, tenantId },
      select: { id: true },
    });
    if (!brand) {
      res.status(400).json({ error: '브랜드를 찾지 못했어요.' });
      return;
    }
  }
  const created = await startWorkEntry(prisma, {
    tenantId,
    userId: user.userId,
    source,
    operatingCompanyId,
    nickname: clip(body.nickname, 80),
    customerName: clip(body.customerName, 120),
    contactPhone: clip(body.contactPhone, 32),
    safePhone: clip(body.safePhone, 32),
  });
  res.status(201).json({ id: created.id });
});

router.get('/unsaved-count', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = actor(req);
  const count = await countPendingUnsaved(prisma, tenantId, user.userId);
  res.json({ count });
});

router.get('/summary', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = actor(req);
  if (!(await userHasStaffAdminAccess(user))) {
    res.status(403).json({ error: '작업 기록 집계는 관리자만 볼 수 있어요.' });
    return;
  }
  const dateRaw = typeof req.query.date === 'string' ? req.query.date : kstToday(new Date());
  const range = kstDayRangeYmd(dateRaw);
  if (!range) {
    res.status(400).json({ error: '날짜는 YYYY-MM-DD 로 보내 주세요.' });
    return;
  }
  const items = await summarizeWorkEntries(prisma, { tenantId, range });
  res.json({ date: dateRaw, items });
});

router.get('/', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = actor(req);
  const isAdmin = await userHasStaffAdminAccess(user);
  const dateRaw = typeof req.query.date === 'string' ? req.query.date : kstToday(new Date());
  const range = kstDayRangeYmd(dateRaw);
  if (!range) {
    res.status(400).json({ error: '날짜는 YYYY-MM-DD 로 보내 주세요.' });
    return;
  }
  const outcome = typeof req.query.outcome === 'string' ? req.query.outcome : null;
  if (outcome && !['OPEN', 'SAVED', 'UNSAVED', 'VIEWED'].includes(outcome)) {
    res.status(400).json({ error: '결과 구분이 올바르지 않아요.' });
    return;
  }
  const limitRaw = Number.parseInt(String(req.query.limit ?? '50'), 10);
  const offsetRaw = Number.parseInt(String(req.query.offset ?? '0'), 10);
  const page = await listWorkEntries(prisma, {
    tenantId,
    isAdmin,
    actorId: user.userId,
    requestedUserId: typeof req.query.userId === 'string' ? req.query.userId : null,
    outcome,
    range,
    limit: Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50,
    offset: Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0,
  });
  res.json({ date: dateRaw, ...page });
});

router.get('/:id', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = actor(req);
  const isAdmin = await userHasStaffAdminAccess(user);
  const item = await getWorkEntry(prisma, { tenantId, isAdmin, actorId: user.userId, id: req.params.id });
  if (!item) {
    res.status(404).json({ error: '작업 기록을 찾지 못했어요.' });
    return;
  }
  res.json({ item });
});

router.patch('/:id', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = actor(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const identity: {
    nickname?: string | null;
    customerName?: string | null;
    contactPhone?: string | null;
    safePhone?: string | null;
  } = {};
  if ('nickname' in body) identity.nickname = clip(body.nickname, 80);
  if ('customerName' in body) identity.customerName = clip(body.customerName, 120);
  if ('contactPhone' in body) identity.contactPhone = clip(body.contactPhone, 32);
  if ('safePhone' in body) identity.safePhone = clip(body.safePhone, 32);
  const result = await patchWorkEntry(prisma, {
    tenantId,
    actorId: user.userId,
    id: req.params.id,
    identity,
    actions: 'actions' in body ? body.actions : undefined,
    draft: body.draft,
    draftProvided: 'draft' in body,
    summary: 'summary' in body ? clip(body.summary, 200) : undefined,
  });
  if ('error' in result) {
    const message = result.error ?? '작업 기록을 찾지 못했어요.';
    res.status(message.includes('길어요') || message.includes('형식') ? 400 : 404).json({ error: message });
    return;
  }
  res.json({ ok: true });
});

router.post('/:id/finish', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = actor(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const outcome = typeof body.outcome === 'string' ? body.outcome : '';
  if (!isFinishOutcome(outcome)) {
    res.status(400).json({ error: '결과 구분이 올바르지 않아요.' });
    return;
  }
  const leftBy = typeof body.leftBy === 'string' ? body.leftBy : null;
  if (leftBy && !isLeftBy(leftBy)) {
    res.status(400).json({ error: '떠난 이유가 올바르지 않아요.' });
    return;
  }
  const savedKind = typeof body.savedKind === 'string' ? body.savedKind : null;
  if (savedKind && !isSavedKind(savedKind)) {
    res.status(400).json({ error: '처리 구분이 올바르지 않아요.' });
    return;
  }
  const result = await finishWorkEntry(prisma, {
    tenantId,
    actorId: user.userId,
    id: req.params.id,
    input: {
      outcome,
      ...('savedKind' in body ? { savedKind } : {}),
      ...(leftBy ? { leftBy } : {}),
      ...('followupId' in body ? { followupId: clip(body.followupId, 80) } : {}),
      ...('inquiryId' in body ? { inquiryId: clip(body.inquiryId, 80) } : {}),
      ...('draft' in body ? { draft: body.draft } : {}),
      ...('summary' in body ? { summary: clip(body.summary, 200) } : {}),
    },
  });
  if ('error' in result) {
    const message = result.error ?? '작업 기록을 찾지 못했어요.';
    res.status(message.includes('형식') || message.includes('길어요') ? 400 : 404).json({ error: message });
    return;
  }
  res.json({ ok: true });
});

router.post('/:id/dismiss', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const result = await dismissWorkEntry(prisma, tenantId, actor(req).userId, req.params.id);
  if ('error' in result) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

router.post('/:id/resume', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const result = await resumeWorkEntry(prisma, tenantId, actor(req).userId, req.params.id);
  if ('error' in result) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ draft: result.draft });
});

export const telecrmWorkHistoryRouter = router;
