import { Router } from 'express';
import type { Response } from 'express';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireTelecrmActorPassword, requireTelecrmTenant } from './telecrm.helpers.js';
import {
  createQuickQuoteKind,
  deleteQuickQuoteKind,
  listQuickQuoteKinds,
  reorderQuickQuoteKinds,
  saveQuickQuoteAutoKind,
  updateQuickQuoteKind,
} from './telecrmQuickQuote.service.js';
import {
  listQuickQuoteUnits,
  lookupQuickQuoteAreas,
  searchQuickQuoteAddress,
} from './telecrmQuickQuoteAddress.service.js';

const router = Router();

function sendQuickQuoteError(res: Response, e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const map: Record<string, { status: number; error: string }> = {
    BRAND_REQUIRED: { status: 400, error: '브랜드를 선택한 뒤 다시 해 주세요.' },
    INVALID_BRAND: { status: 400, error: '브랜드를 찾을 수 없습니다.' },
    STEPS_REQUIRED: { status: 400, error: '문구를 한 칸 이상 남겨 주세요.' },
    INVALID_PAYBACK: { status: 400, error: '페이백 금액이 올바르지 않습니다.' },
    LABEL_REQUIRED: { status: 400, error: '견적 종류 이름을 입력해 주세요.' },
    LABEL_TOO_LONG: { status: 400, error: '견적 종류 이름은 40자까지 입력할 수 있어요.' },
    LABEL_RESERVED: { status: 400, error: '견적보내기 이름은 기본 문구에 쓰여요. 다른 이름을 입력해 주세요.' },
    LABEL_TAKEN: { status: 400, error: '같은 이름의 견적 종류가 있어요.' },
    NOT_FOUND: { status: 404, error: '견적 종류를 찾을 수 없어요.' },
    INVALID_ORDER: { status: 400, error: '순서를 바꾸지 못했어요.' },
    LOOKUP_UNAVAILABLE: { status: 503, error: '주소 조회를 아직 쓸 수 없어요.' },
    LOOKUP_LIMIT: { status: 429, error: '오늘 주소 조회 횟수를 모두 썼어요. 내일 다시 조회할 수 있어요.' },
    LOOKUP_FAILED: { status: 502, error: '주소를 찾지 못했어요. 잠시 뒤 다시 해 주세요.' },
    LOOKUP_QUERY: { status: 400, error: '주소를 다시 확인해 주세요.' },
  };
  const hit = map[e.message];
  if (!hit) return false;
  res.status(hit.status).json({ error: hit.error });
  return true;
}

router.get('/kinds', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    res.json(await listQuickQuoteKinds(tenantId, req.query.operatingCompanyId));
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

router.put('/kinds/auto_quote', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const body = (req.body ?? {}) as { operatingCompanyId?: unknown; steps?: unknown; paybackWon?: unknown };
  try {
    res.json(
      await saveQuickQuoteAutoKind(tenantId, body.operatingCompanyId, {
        steps: body.steps,
        paybackWon: body.paybackWon,
      }),
    );
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

router.post('/kinds', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const body = (req.body ?? {}) as {
    operatingCompanyId?: unknown;
    label?: unknown;
    steps?: unknown;
    paybackWon?: unknown;
  };
  try {
    res.status(201).json(
      await createQuickQuoteKind(tenantId, body.operatingCompanyId, {
        label: body.label,
        steps: body.steps,
        paybackWon: body.paybackWon,
      }),
    );
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

router.put('/kinds/reorder', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const body = (req.body ?? {}) as { operatingCompanyId?: unknown; orderedIds?: unknown };
  try {
    res.json(await reorderQuickQuoteKinds(tenantId, body.operatingCompanyId, body.orderedIds));
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

router.put('/kinds/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  if (req.params.id === 'auto_quote' || req.params.id === 'reorder') {
    res.status(404).json({ error: '견적 종류를 찾을 수 없어요.' });
    return;
  }
  const body = (req.body ?? {}) as {
    operatingCompanyId?: unknown;
    label?: unknown;
    steps?: unknown;
    paybackWon?: unknown;
  };
  try {
    res.json(
      await updateQuickQuoteKind(tenantId, body.operatingCompanyId, req.params.id, {
        label: body.label,
        steps: body.steps,
        paybackWon: body.paybackWon,
      }),
    );
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

router.delete('/kinds/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = (req.body ?? {}) as { password?: unknown; operatingCompanyId?: unknown };
  if (!(await requireTelecrmActorPassword(res, user.userId, tenantId, body.password))) return;
  try {
    res.json(await deleteQuickQuoteKind(tenantId, body.operatingCompanyId, req.params.id));
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

function queryText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}

function digitsOf(value: unknown, length?: number): string | null {
  const text = queryText(value, 20);
  if (!/^\d+$/.test(text)) return null;
  if (length != null && text.length !== length) return null;
  return text;
}

function bit(value: unknown): '0' | '1' | null {
  const text = queryText(value, 1);
  if (text === '0' || text === '1') return text;
  return null;
}

router.get('/address', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const q = queryText(req.query.q, 80);
  if (q.length < 2) {
    res.status(400).json({ error: '주소를 두 글자 이상 입력해 주세요.' });
    return;
  }
  try {
    res.json({ items: await searchQuickQuoteAddress(tenantId, q) });
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

router.get('/units', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const admCd = digitsOf(req.query.admCd, 10);
  const rnMgtSn = digitsOf(req.query.rnMgtSn);
  const udrtYn = bit(req.query.udrtYn);
  const buldMnnm = digitsOf(req.query.buldMnnm);
  const buldSlno = digitsOf(req.query.buldSlno);
  if (!admCd || !rnMgtSn || !udrtYn || !buldMnnm || buldSlno == null) {
    res.status(400).json({ error: '주소를 다시 확인해 주세요.' });
    return;
  }
  try {
    res.json(
      await listQuickQuoteUnits(
        tenantId,
        { admCd, rnMgtSn, udrtYn, buldMnnm, buldSlno },
        queryText(req.query.dongNm, 40),
      ),
    );
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

router.get('/areas', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const admCd = digitsOf(req.query.admCd, 10);
  const rnMgtSn = digitsOf(req.query.rnMgtSn);
  const udrtYn = bit(req.query.udrtYn);
  const buldMnnm = digitsOf(req.query.buldMnnm);
  const buldSlno = digitsOf(req.query.buldSlno);
  const lnbrMnnm = digitsOf(req.query.lnbrMnnm);
  const lnbrSlno = digitsOf(req.query.lnbrSlno);
  const mtYn = bit(req.query.mtYn);
  if (!admCd || !rnMgtSn || !udrtYn || !buldMnnm || buldSlno == null || !lnbrMnnm || lnbrSlno == null || !mtYn) {
    res.status(400).json({ error: '주소를 다시 확인해 주세요.' });
    return;
  }
  try {
    res.json(
      await lookupQuickQuoteAreas(
        tenantId,
        { admCd, rnMgtSn, udrtYn, buldMnnm, buldSlno, lnbrMnnm, lnbrSlno, mtYn },
        queryText(req.query.dongNm, 40),
        queryText(req.query.hoNm, 40),
      ),
    );
  } catch (e) {
    if (sendQuickQuoteError(res, e)) return;
    throw e;
  }
});

export const telecrmQuickQuoteRouter = router;
