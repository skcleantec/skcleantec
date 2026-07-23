import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireCrmWorkOperatingCompanyId, requireTelecrmTenant } from './telecrm.helpers.js';
import {
  finalizeTelecrmConsultationQuote,
  linkTelecrmConsultationQuoteInquiry,
  listTelecrmConsultationQuotesForPhone,
  normalizeTelecrmQuotePhone,
  parseTelecrmConsultationQuotePayload,
  supersedeTelecrmConsultationQuotesForPhone,
  upsertTelecrmConsultationQuoteDraft,
} from './telecrmConsultationQuote.service.js';
import { mapLeadSourceValidationError } from '../inquiry-lead-sources/inquiryLeadSource.service.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

router.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const phoneRaw = typeof req.query.phone === 'string' ? req.query.phone : '';
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) {
    res.status(400).json({ error: '전화번호(4자 이상)가 필요합니다.' });
    return;
  }
  const result = await listTelecrmConsultationQuotesForPhone(tenantId, operatingCompanyId, phone);
  res.json(result);
});

router.put('/current', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { phone: phoneRaw, payload } = req.body as { phone?: string; payload?: unknown };
  const phone = normalizeTelecrmQuotePhone(typeof phoneRaw === 'string' ? phoneRaw : '');
  if (phone.length < 4) {
    res.status(400).json({ error: '전화번호(4자 이상)가 필요합니다.' });
    return;
  }
  const parsed = parseTelecrmConsultationQuotePayload(payload);
  if (!parsed) {
    res.status(400).json({ error: '저장할 견적 내용이 없습니다.' });
    return;
  }
  const row = await upsertTelecrmConsultationQuoteDraft(
    tenantId,
    operatingCompanyId,
    user.userId,
    phone,
    parsed,
  );
  res.json(row);
});

router.post('/supersede-active', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { phone: phoneRaw } = req.body as { phone?: string };
  const phone = normalizeTelecrmQuotePhone(typeof phoneRaw === 'string' ? phoneRaw : '');
  if (phone.length < 4) {
    res.status(400).json({ error: '전화번호(4자 이상)가 필요합니다.' });
    return;
  }
  await supersedeTelecrmConsultationQuotesForPhone(tenantId, operatingCompanyId, user.userId, phone);
  res.json({ ok: true });
});

router.post('/finalize', requireStaffPermission('followup.edit', 'crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as Record<string, unknown>;
  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) {
    res.status(400).json({ error: '전화번호(4자 이상)가 필요합니다.' });
    return;
  }
  const parsed = parseTelecrmConsultationQuotePayload(body.payload);
  if (!parsed) {
    res.status(400).json({ error: '저장할 견적 내용이 없습니다.' });
    return;
  }
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  if (!customerName) {
    res.status(400).json({ error: '고객명(또는 닉네임)이 필요합니다.' });
    return;
  }
  const statusRaw = typeof body.followupStatus === 'string' ? body.followupStatus.toUpperCase().trim() : '';
  if (statusRaw !== 'ABSENT' && statusRaw !== 'ON_HOLD') {
    res.status(400).json({ error: 'followupStatus는 ABSENT 또는 ON_HOLD여야 합니다.' });
    return;
  }
  let preferredMoveInCleaningDate: string | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'preferredMoveInCleaningDate')) {
    const pmd = body.preferredMoveInCleaningDate;
    if (pmd == null || pmd === '') {
      preferredMoveInCleaningDate = null;
    } else if (typeof pmd === 'string') {
      const s = pmd.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        res.status(400).json({ error: '입주청소 희망 날짜는 YYYY-MM-DD 형식이어야 합니다.' });
        return;
      }
      preferredMoveInCleaningDate = s;
    } else {
      res.status(400).json({ error: '입주청소 희망 날짜 형식이 올바르지 않습니다.' });
      return;
    }
  }
  try {
    const strictLeadSource =
      body.strictLeadSource === true || body.strictLeadSource === 'true';
    const result = await finalizeTelecrmConsultationQuote(tenantId, operatingCompanyId, user.userId, {
      phone,
      payload: parsed,
      customerName,
      nickname: typeof body.nickname === 'string' ? body.nickname : null,
      goldDb: body.goldDb === true,
      preferredMoveInCleaningDate,
      followupStatus: statusRaw,
      extraMemo: typeof body.extraMemo === 'string' ? body.extraMemo : null,
      actorName: typeof body.actorName === 'string' ? body.actorName : null,
      leadSource: typeof body.leadSource === 'string' ? body.leadSource : null,
      strictLeadSource,
    });
    res.status(result.followupCreated ? 201 : 200).json(result);
  } catch (e) {
    const mapped = mapLeadSourceValidationError(e);
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.message });
      return;
    }
    res.status(400).json({ error: e instanceof Error ? e.message : '견적 확정 실패' });
  }
});

router.post('/link-inquiry', requireStaffPermission('orderform.issue', 'crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const operatingCompanyId = await requireCrmWorkOperatingCompanyId(req, res);
  if (!operatingCompanyId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as Record<string, unknown>;
  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  const phone = normalizeTelecrmQuotePhone(phoneRaw);
  if (phone.length < 4) {
    res.status(400).json({ error: '전화번호(4자 이상)가 필요합니다.' });
    return;
  }
  try {
    const quote = await linkTelecrmConsultationQuoteInquiry(tenantId, operatingCompanyId, user.userId, {
      phone,
      inquiryId: typeof body.inquiryId === 'string' ? body.inquiryId : null,
      orderFormId: typeof body.orderFormId === 'string' ? body.orderFormId : null,
    });
    if (!quote) {
      res.status(404).json({ error: '연결할 견적이 없습니다.' });
      return;
    }
    res.json({ quote });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '견적 연결 실패' });
  }
});

export const telecrmConsultationQuotesRouter = router;
