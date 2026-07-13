import { Router } from 'express';
import type {
  TenantBillingAdjustmentType,
  TenantBillingCycle,
  TenantBillingPricingMode,
} from '@prisma/client';
import {
  platformAuthMiddleware,
  platformSuperAdminOnly,
  type PlatformScopedRequest,
} from './platformAuth.middleware.js';
import {
  confirmInvoicePayment,
  confirmPrepaidForTenant,
  createTenantBillingAdjustment,
  getPlatformBillingSettings,
  getTenantBillingDetailForPlatform,
  getTenantBillingSchedule,
  issueInvoiceForTenant,
  listTenantsBillingOverview,
  previewNextInvoice,
  updatePlatformBillingSettings,
  updateTenantBillingProfileContract,
  voidTenantBillingAdjustment,
} from '../billing/tenantBilling.service.js';
import { updateTenantBasics } from './tenantProvisioning.service.js';
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

router.get('/tenants/:tenantId/schedule', async (req, res) => {
  try {
    const schedule = await getTenantBillingSchedule(req.params.tenantId);
    res.json(schedule);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '일정 조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.patch('/tenants/:tenantId/profile', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      plan?: string;
      billingCycle?: TenantBillingCycle;
      pricingMode?: TenantBillingPricingMode;
      customMonthlyAmountKrw?: number | null;
      customAnnualAmountKrw?: number | null;
      billingDueDay?: number;
      billingStartDate?: string | null;
      autoIssueEnabled?: boolean;
      contractMemo?: string | null;
    };
    if (body.plan !== undefined) {
      if (!(body.plan in { starter: 1, standard: 1, premium: 1 })) {
        res.status(400).json({ error: 'plan은 starter, standard, premium 중 하나여야 합니다.' });
        return;
      }
      await updateTenantBasics(req.params.tenantId, { plan: body.plan });
    }
    if (body.billingCycle && body.billingCycle !== 'MONTHLY' && body.billingCycle !== 'ANNUAL') {
      res.status(400).json({ error: 'billingCycle은 MONTHLY 또는 ANNUAL 이어야 합니다.' });
      return;
    }
    if (body.pricingMode && body.pricingMode !== 'CATALOG' && body.pricingMode !== 'CUSTOM') {
      res.status(400).json({ error: 'pricingMode는 CATALOG 또는 CUSTOM 이어야 합니다.' });
      return;
    }
    const profile = await updateTenantBillingProfileContract(req.params.tenantId, body);
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

router.post('/tenants/:tenantId/adjustments', platformSuperAdminOnly, async (req, res) => {
  try {
    const platformUser = (req as PlatformScopedRequest).platformUser;
    const body = req.body as {
      type?: TenantBillingAdjustmentType;
      targetPeriodStart?: string;
      customAmountKrw?: number | null;
      reason?: string;
    };
    if (
      !body.type ||
      !['SKIP', 'CUSTOM_AMOUNT', 'DEFER_SHIFT', 'DEFER_MERGE'].includes(body.type)
    ) {
      res.status(400).json({ error: 'type이 올바르지 않습니다.' });
      return;
    }
    if (!body.targetPeriodStart || !body.reason) {
      res.status(400).json({ error: 'targetPeriodStart와 reason이 필요합니다.' });
      return;
    }
    const adjustment = await createTenantBillingAdjustment(
      req.params.tenantId,
      platformUser.platformUserId,
      {
        type: body.type,
        targetPeriodStart: body.targetPeriodStart,
        customAmountKrw: body.customAmountKrw,
        reason: body.reason,
      },
    );
    res.status(201).json({ adjustment });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '예외 등록에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.delete('/tenants/:tenantId/adjustments/:adjustmentId', platformSuperAdminOnly, async (req, res) => {
  try {
    await voidTenantBillingAdjustment(req.params.tenantId, req.params.adjustmentId);
    res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '예외 취소에 실패했습니다.';
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
    const invoice = await issueInvoiceForTenant(req.params.tenantId, body.asDraft === true, 'MANUAL');
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
