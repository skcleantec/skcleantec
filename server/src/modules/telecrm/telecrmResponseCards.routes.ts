import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import { requireCrmWorkOperatingCompanyId, requireTelecrmTenant } from './telecrm.helpers.js';
import { coachResponseCards } from './telecrmResponseCards.coach.js';
import {
  browseResponseCards,
  feedbackResponseCard,
  importResponseCards,
  isResponseCardStatus,
  listResponseCards,
  listResponseSearchGaps,
  parseImportedResponseCard,
  patchResponseCard,
  searchResponseCards,
  type ResponseCardPatch,
} from './telecrmResponseCards.service.js';

const router = Router();

async function requireCardAdmin(req: import('express').Request, res: import('express').Response): Promise<AuthPayload | null> {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (!(await userHasStaffAdminAccess(user))) {
    res.status(403).json({ error: '관리자만 할 수 있습니다.' });
    return null;
  }
  return user;
}

function readString(raw: unknown, max: number): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  return text ? text.slice(0, max) : undefined;
}

function readManWon(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0 || raw > 9999) return undefined;
  return Math.round(raw * 10) / 10;
}

function readQuoteItems(raw: unknown): { label: string; manWon: number }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: { label: string; manWon: number }[] = [];
  for (const row of raw.slice(0, 8)) {
    if (!row || typeof row !== 'object') continue;
    const label = readString((row as { label?: unknown }).label, 40);
    const manWon = readManWon((row as { manWon?: unknown }).manWon);
    if (!label || manWon == null) continue;
    items.push({ label, manWon });
  }
  return items.length ? items : undefined;
}

router.post('/import', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = await requireCardAdmin(req, res);
  if (!user) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;

  const body = req.body;
  const rawItems = Array.isArray(body) ? body : body && typeof body === 'object' && Array.isArray((body as { cards?: unknown }).cards)
    ? (body as { cards: unknown[] }).cards
    : null;
  if (!rawItems) {
    res.status(400).json({ error: '대응 카드 목록이 필요합니다.' });
    return;
  }
  if (rawItems.length > 400) {
    res.status(400).json({ error: '한 번에 400장까지 불러올 수 있습니다.' });
    return;
  }
  const items = rawItems.map(parseImportedResponseCard).filter((item): item is NonNullable<typeof item> => item != null);
  if (items.length === 0) {
    res.status(400).json({ error: '불러올 수 있는 카드가 없습니다.' });
    return;
  }
  try {
    const result = await importResponseCards({
      tenantId,
      userId: user.userId,
      operatingCompanyId,
      items,
    });
    res.json(result);
  } catch (e) {
    console.error('[telecrm-cards] import failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '대응 카드를 저장하지 못했습니다.' });
  }
});

router.get('/search', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q || q.length > 300) {
    res.status(400).json({ error: '검색어를 입력해 주세요.' });
    return;
  }
  try {
    const result = await searchResponseCards({
      tenantId,
      userId: user.userId,
      operatingCompanyId,
      q,
    });
    res.json(result);
  } catch (e) {
    console.error('[telecrm-cards] search failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '대응 카드를 찾지 못했습니다.' });
  }
});

router.get('/browse', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  try {
    res.json(
      await browseResponseCards({
        tenantId,
        userId: user.userId,
        operatingCompanyId,
      }),
    );
  } catch (e) {
    console.error('[telecrm-cards] browse failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '대응 카드를 불러오지 못했습니다.' });
  }
});

router.get('/search-gaps', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  if (!(await requireCardAdmin(req, res))) return;
  try {
    res.json(await listResponseSearchGaps(tenantId));
  } catch (e) {
    console.error('[telecrm-cards] search-gaps failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '검색 빈칸을 불러오지 못했습니다.' });
  }
});

router.post('/coach', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;

  const body = req.body as {
    q?: unknown;
    cardIds?: unknown;
    stream?: unknown;
    customer?: {
      pyeong?: unknown;
      structure?: unknown;
      cleaningType?: unknown;
      brand?: unknown;
      step?: unknown;
      quoteTotalManWon?: unknown;
      quoteItems?: unknown;
    };
  };
  const q = typeof body.q === 'string' ? body.q.trim() : '';
  if (!q || q.length > 500) {
    res.status(400).json({ error: '상담 내용을 입력해 주세요.' });
    return;
  }
  const cardIds = Array.isArray(body.cardIds)
    ? body.cardIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).slice(0, 6)
    : [];
  const customer = {
    pyeong: readString(body.customer?.pyeong, 40),
    structure: readString(body.customer?.structure, 80),
    cleaningType: readString(body.customer?.cleaningType, 40),
    brand: readString(body.customer?.brand, 40),
    step: readString(body.customer?.step, 40),
    quoteTotalManWon: readManWon(body.customer?.quoteTotalManWon),
    quoteItems: readQuoteItems(body.customer?.quoteItems),
  };
  const stream = body.stream === true;

  try {
    if (!stream) {
      const result = await coachResponseCards({
        tenantId,
        userId: user.userId,
        operatingCompanyId,
        q,
        cardIds,
        customer,
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error, code: result.code });
        return;
      }
      res.json(result.data);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const result = await coachResponseCards({
      tenantId,
      userId: user.userId,
      operatingCompanyId,
      q,
      cardIds,
      customer,
      onDelta: (text) => {
        res.write(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`);
      },
    });
    if (!result.ok) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: result.error, code: result.code })}\n\n`);
      res.end();
      return;
    }
    res.write(`event: done\ndata: ${JSON.stringify(result.data)}\n\n`);
    res.end();
  } catch (e) {
    console.error('[telecrm-cards] coach failed', e instanceof Error ? e.message : e);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(500).json({ error: 'AI 코치에 실패했습니다.' });
  }
});

router.get('/', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  if (!(await requireCardAdmin(req, res))) return;
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'draft';
  if (!isResponseCardStatus(statusRaw)) {
    res.status(400).json({ error: '상태를 확인해 주세요.' });
    return;
  }
  const brand = typeof req.query.workBrand === 'string' ? req.query.workBrand.trim() : '';
  const companyQuery = typeof req.query.operatingCompanyId === 'string' ? req.query.operatingCompanyId.trim() : '';
  let operatingCompanyId: string | null = null;
  if (brand || companyQuery) {
    operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
    if (!operatingCompanyId) return;
  }
  try {
    res.json(await listResponseCards({ tenantId, status: statusRaw, operatingCompanyId }));
  } catch (e) {
    console.error('[telecrm-cards] list failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '대응 카드를 불러오지 못했습니다.' });
  }
});

router.post('/:id/feedback', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const action = (req.body as { action?: unknown })?.action;
  if (action !== 'copy' && action !== 'up' && action !== 'down') {
    res.status(400).json({ error: '피드백 종류를 확인해 주세요.' });
    return;
  }
  const inquiryId = readString((req.body as { inquiryId?: unknown })?.inquiryId, 80) ?? null;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  try {
    const result = await feedbackResponseCard({
      tenantId,
      userId: user.userId,
      operatingCompanyId,
      id: req.params.id,
      action,
      inquiryId,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (e) {
    console.error('[telecrm-cards] feedback failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '피드백을 저장하지 못했습니다.' });
  }
});

router.patch('/:id', async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = await requireCardAdmin(req, res);
  if (!user) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const body = req.body as Record<string, unknown>;
  const status = typeof body.status === 'string' ? body.status : undefined;
  if (status != null && !isResponseCardStatus(status)) {
    res.status(400).json({ error: '상태를 확인해 주세요.' });
    return;
  }
  const patch: ResponseCardPatch = {};
  if (typeof body.category === 'string') patch.category = body.category.trim();
  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (typeof body.intent === 'string') patch.intent = body.intent;
  if (typeof body.rule === 'string') patch.rule = body.rule;
  if (typeof body.wonInCall === 'boolean') patch.wonInCall = body.wonInCall;
  if (status) patch.status = status;
  if (Array.isArray(body.triggers)) {
    patch.triggers = body.triggers.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (Array.isArray(body.avoid)) {
    patch.avoid = body.avoid.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (Array.isArray(body.sources)) {
    patch.sources = body.sources.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (Array.isArray(body.responses)) {
    const responses: [string, string][] = [];
    for (const row of body.responses) {
      if (Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'string') {
        responses.push([row[0].trim(), row[1].trim()]);
      }
    }
    patch.responses = responses;
  }
  try {
    const result = await patchResponseCard({
      tenantId,
      userId: user.userId,
      operatingCompanyId,
      id: req.params.id,
      patch,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[telecrm-cards] patch failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: '대응 카드를 수정하지 못했습니다.' });
  }
});

export const telecrmResponseCardsRouter = router;
