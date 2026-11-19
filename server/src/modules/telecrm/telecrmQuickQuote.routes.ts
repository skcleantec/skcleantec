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

export const telecrmQuickQuoteRouter = router;
