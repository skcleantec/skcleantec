import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from './tenantScope.helpers.js';
import { getTenantBillingSummaryForAdmin, getTenantBillingSchedule, listTenantInvoices } from '../billing/tenantBilling.service.js';
import { getTenantBillingDunningForAdmin } from '../billing/tenantBilling.dunning.js';
import {
  PaymentConfirmationRequestError,
  requestTenantPaymentConfirmation,
} from '../billing/tenantBilling.paymentRequest.service.js';

const router = Router();

router.use(authMiddleware);

/** GET /api/admin/tenant-billing/summary — ADMIN 이용료·납부 요약 (읽기 전용) */
router.get('/summary', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 조회할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  try {
    const summary = await getTenantBillingSummaryForAdmin(tenantId);
    res.json(summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

/** GET /api/admin/tenant-billing/dunning — ADMIN 연체 독촉 팝업용 */
router.get('/dunning', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 조회할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  try {
    const dunning = await getTenantBillingDunningForAdmin(tenantId);
    res.json(dunning);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

/** POST /api/admin/tenant-billing/payment-confirmation-request — 입금 확인 요청 (플랫폼 이메일) */
router.post('/payment-confirmation-request', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 요청할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as { invoiceId?: string };
  try {
    const result = await requestTenantPaymentConfirmation({
      tenantId,
      invoiceId: typeof body.invoiceId === 'string' ? body.invoiceId.trim() : undefined,
      requesterUserId: auth.userId,
      requesterName: auth.email,
      requesterEmail: auth.email,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof PaymentConfirmationRequestError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '요청에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

/** GET /api/admin/tenant-billing/invoices — 청구서 목록 (읽기 전용) */
router.get('/invoices', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 조회할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  try {
    const items = await listTenantInvoices(tenantId);
    res.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

/** GET /api/admin/tenant-billing/schedule — 납부 일정 (읽기 전용) */
router.get('/schedule', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 조회할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  try {
    const schedule = await getTenantBillingSchedule(tenantId);
    res.json({
      billingStartDate: schedule.billingStartDate,
      serviceStartedAt: schedule.serviceStartedAt,
      billingDueDay: schedule.profile.billingDueDay,
      items: schedule.items.filter((i) => i.status !== 'SKIPPED' && i.status !== 'DEFERRED').slice(0, 8),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
