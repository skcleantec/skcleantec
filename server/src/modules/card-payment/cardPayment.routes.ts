import { Router, type Request } from 'express';
import type { CardPaymentStatus } from '@prisma/client';
import { CARD_PAYMENT_MODULE_ID, CARD_PAYMENT_STATUSES } from './cardPayment.constants.js';
import { requireTenantAuth, type TenantScopedRequest } from '../tenants/tenant.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';
import { getCredentialPublic } from './cardPaymentCredential.service.js';
import {
  getOrPrefillOnboarding,
  saveOnboardingDraft,
  submitOnboarding,
} from './cardPaymentOnboarding.service.js';
import {
  confirmCustomerLink,
  confirmKeyin,
  createCardPaymentIntent,
  loadInquiryForCardPayment,
  quoteCardPayment,
} from './cardPaymentIntent.service.js';
import { startPaysisWindow } from './cardPaymentWindow.service.js';
import { listCardPayments } from './cardPaymentList.service.js';
import { defaultCardPaymentAmountWon } from './cardPaymentFee.js';
import { prisma } from '../../lib/prisma.js';
const router = Router();

router.use(requireTenantAuth, requireFeature(CARD_PAYMENT_MODULE_ID));

function scoped(req: Request): TenantScopedRequest {
  return req as TenantScopedRequest;
}

async function canUseInquiry(tenantId: string, user: AuthPayload, inquiryId: string) {
  if (user.role === 'ADMIN' || user.role === 'MARKETER') return true;
  const assigned = await prisma.assignment.findFirst({
    where: { tenantId, inquiryId, teamLeaderId: user.userId },
    select: { id: true },
  });
  return Boolean(assigned);
}

router.get('/quote', async (req, res) => {
  const amountWon = Math.round(Number(req.query.amount) || 0);
  const quote = await quoteCardPayment(amountWon);
  res.json(quote);
});

router.get('/inquiry/:inquiryId/prefill', async (req, res) => {
  const user = scoped(req).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const inquiry = await loadInquiryForCardPayment(tenantId, String(req.params.inquiryId));
  if (!inquiry) {
    res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
    return;
  }
  const ok = await canUseInquiry(tenantId, user, inquiry.id);
  if (!ok) {
    res.status(403).json({ error: '이 접수의 카드결재 권한이 없습니다.' });
    return;
  }
  const amountWon = defaultCardPaymentAmountWon(inquiry);
  const quote = await quoteCardPayment(amountWon);
  const pg = await getCredentialPublic(tenantId);
  res.json({
    inquiryId: inquiry.id,
    inquiryNumber: inquiry.inquiryNumber,
    customerName: inquiry.customerName,
    amountWon,
    quote,
    pgConnected: pg.connected ? pg.isActive : false,
  });
});

router.get('/pg', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, scoped(req).user);
  if (!tenantId) return;
  const [onboarding, credential] = await Promise.all([
    getOrPrefillOnboarding(tenantId),
    getCredentialPublic(tenantId),
  ]);
  res.json({ onboarding, credential });
});

router.put('/pg/onboarding', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, scoped(req).user);
  if (!tenantId) return;
  if (scoped(req).user.role !== 'ADMIN') {
    res.status(403).json({ error: 'PG 연동은 관리자만 저장할 수 있습니다.' });
    return;
  }
  const row = await saveOnboardingDraft(tenantId, req.body ?? {});
  res.json(row);
});

router.post('/pg/onboarding/submit', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, scoped(req).user);
  if (!tenantId) return;
  if (scoped(req).user.role !== 'ADMIN') {
    res.status(403).json({ error: 'PG 가입 신청은 관리자만 할 수 있습니다.' });
    return;
  }
  const row = await submitOnboarding(tenantId, req.body ?? {});
  res.json(row);
});

router.get('/', async (req, res) => {
  const user = scoped(req).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : '';
  const status = CARD_PAYMENT_STATUSES.includes(statusRaw as CardPaymentStatus)
    ? (statusRaw as CardPaymentStatus)
    : undefined;
  const range = createdAtRangeFromQuery({
    datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : 'today',
    month: typeof req.query.month === 'string' ? req.query.month : undefined,
    day: typeof req.query.day === 'string' ? req.query.day : undefined,
  });
  const createdById =
    user.role === 'TEAM_LEADER' && req.query.mine === '1' ? user.userId : undefined;
  const result = await listCardPayments({
    tenantId,
    createdById,
    status,
    from: range?.gte,
    to: range?.lte,
    limit,
    offset,
  });
  res.json(result);
});

router.post('/', async (req, res) => {
  const user = scoped(req).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const inquiryId = String(req.body?.inquiryId ?? '');
  const methodRaw = String(req.body?.method ?? 'KEYIN');
  const method =
    methodRaw === 'CUSTOMER_LINK' ? 'CUSTOMER_LINK' : methodRaw === 'PAY_WINDOW' ? 'PAY_WINDOW' : 'KEYIN';
  const payScreen = req.body?.payScreen === 'M' ? 'M' : 'P';
  const amountWon = Math.round(Number(req.body?.amountWon) || 0);
  if (!inquiryId) {
    res.status(400).json({ error: '접수를 선택해 주세요.' });
    return;
  }
  const ok = await canUseInquiry(tenantId, user, inquiryId);
  if (!ok) {
    res.status(403).json({ error: '이 접수의 카드결재 권한이 없습니다.' });
    return;
  }
  const result = await createCardPaymentIntent({
    tenantId,
    userId: user.userId,
    inquiryId,
    amountWon,
    method,
    payScreen,
  });
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(result);
});

router.post('/:id/window', async (req, res) => {
  const user = scoped(req).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.cardNumber || body.cvc || body.cardCvc || body.expiry || body.cardExpiry || body.cardNo) {
    res.status(400).json({ error: '카드번호는 결제창에서만 입력합니다.' });
    return;
  }
  const result = await startPaysisWindow({
    tenantId,
    paymentId: String(req.params.id),
    payScreen: body.payScreen === 'M' ? 'M' : 'P',
  });
  if ('error' in result) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.post('/:id/keyin', async (req, res) => {
  const user = scoped(req).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.cardNumber || body.cvc || body.cardCvc || body.expiry || body.cardExpiry) {
    res.status(400).json({ error: '카드번호는 원성페이먼츠 창에서만 입력합니다.' });
    return;
  }
  const result = await confirmKeyin({
    tenantId,
    userId: user.userId,
    paymentId: String(req.params.id),
  });
  if ('error' in result) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.post('/:id/link', async (req, res) => {
  const user = scoped(req).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const result = await confirmCustomerLink({
    tenantId,
    userId: user.userId,
    paymentId: String(req.params.id),
  });
  if ('error' in result) {
    res.status(result.status ?? 400).json({ error: result.error });
    return;
  }
  res.json(result);
});

export default router;
