import { Router } from 'express';
import type { TenantBillingCycle } from '@prisma/client';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
  type PlatformScopedRequest,
} from './platformAuth.middleware.js';
import {
  confirmInvoicePayment,
  confirmPrepaidForTenant,
  getPlatformBillingSettings,
  getTenantBillingDetailForPlatform,
  issueInvoiceForTenant,
  listTenantsBillingOverview,
  previewNextInvoice,
  updatePlatformBillingSettings,
  updateTenantBillingProfile,
} from '../billing/tenantBilling.service.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';

const router = Router();

router.use(platformAuthMiddleware);

router.get('/settings', async (_req, res) => {
  const settings = await getPlatformBillingSettings();
  res.json(settings);
});

router.patch('/settings', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      bankName?: string | null;
      accountNumber?: string | null;
      accountHolder?: string | null;
      paymentGuideText?: string | null;
      overdueGraceDays?: number;
    };
    const settings = await updatePlatformBillingSettings(body);
    res.json(settings);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/tenants', async (_req, res) => {
  const items = await listTenantsBillingOverview();
  res.json({ items });
});

router.get('/tenants/:tenantId', async (req, res) => {
  try {
    const detail = await getTenantBillingDetailForPlatform(req.params.tenantId);
    res.json(detail);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.patch('/tenants/:tenantId/profile', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as { billingCycle?: TenantBillingCycle };
    if (body.billingCycle !== 'MONTHLY' && body.billingCycle !== 'ANNUAL') {
      res.status(400).json({ error: 'billingCycle은 MONTHLY 또는 ANNUAL 이어야 합니다.' });
      return;
    }
    const profile = await updateTenantBillingProfile(req.params.tenantId, body.billingCycle);
    res.json(profile);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/tenants/:tenantId/invoice-preview', async (req, res) => {
  try {
    const preview = await previewNextInvoice(req.params.tenantId);
    res.json(preview);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '미리보기에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/tenants/:tenantId/invoices', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as { asDraft?: boolean };
    const invoice = await issueInvoiceForTenant(req.params.tenantId, body.asDraft === true);
    res.status(201).json({ invoice });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '청구서 발행에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/tenants/:tenantId/prepaid-confirm', platformSuperAdminOnly, async (req, res) => {
  try {
    const result = await confirmPrepaidForTenant(req.params.tenantId);
    res.json(result);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '선납 확인에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/invoices/:invoiceId/confirm-payment', platformSuperAdminOnly, async (req, res) => {
  try {
    const platformUser = (req as PlatformScopedRequest).platformUser;
    const invoice = await confirmInvoicePayment(req.params.invoiceId, platformUser.platformUserId);
    res.json({ invoice });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '납부 확인에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
