import { prisma } from '../../lib/prisma.js';
import {
  ensureTenantBillingProfile,
  mapBillingProfile,
  type BillingProfileDto,
} from './tenantBilling.profile.service.js';
import { resolvePeriodBaseAmountKrw, type BillingProfileInput } from './tenantBilling.schedule.js';

/** 약정(CUSTOM) 금액 0원 — 이용료·청구·접속 제한 없이 이용 */
export function isBillingProfileFeeExempt(profile: BillingProfileInput, plan: string): boolean {
  if (profile.pricingMode !== 'CUSTOM') return false;
  return resolvePeriodBaseAmountKrw(profile, plan, profile.billingCycle) <= 0;
}

export function isBillingProfileDtoFeeExempt(profile: BillingProfileDto, plan: string): boolean {
  return isBillingProfileFeeExempt(profile, plan);
}

export async function isTenantBillingFeeExemptByTenantId(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) return false;
  const profileRow = await prisma.tenantBillingProfile.findUnique({ where: { tenantId } });
  if (!profileRow) return false;
  return isBillingProfileFeeExempt(mapBillingProfile(profileRow), tenant.plan);
}

/** 0원 약정 업체 — 정식 이용 활성화·미납 제한 해제·미결 청구 무효 */
export async function applyTenantBillingFeeExemptState(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      serviceStartedAt: true,
      prepaidConfirmedAt: true,
      status: true,
      suspendReason: true,
      billingAccessBlockedAt: true,
    },
  });
  if (!tenant) return false;

  const profileRow = await ensureTenantBillingProfile(tenantId);
  const profile = mapBillingProfile(profileRow);
  if (!isBillingProfileFeeExempt(profile, tenant.plan)) return false;

  const now = new Date();
  const serviceStart =
    tenant.serviceStartedAt ??
    (profile.billingStartDate ? new Date(profile.billingStartDate) : null) ??
    now;

  const needsTenantPatch =
    tenant.status !== 'ACTIVE' ||
    tenant.suspendReason != null ||
    tenant.billingAccessBlockedAt != null ||
    tenant.serviceStartedAt == null ||
    tenant.prepaidConfirmedAt == null;

  const openInvoices = await prisma.tenantInvoice.count({
    where: { tenantId, status: { in: ['ISSUED', 'OVERDUE'] } },
  });

  if (!needsTenantPatch && openInvoices === 0) return false;

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        serviceStartedAt: serviceStart,
        prepaidConfirmedAt: tenant.prepaidConfirmedAt ?? now,
        status: 'ACTIVE',
        suspendReason: null,
        billingAccessBlockedAt: null,
        suspendedAt: null,
      },
    });
    if (openInvoices > 0) {
      await tx.tenantInvoice.updateMany({
        where: { tenantId, status: { in: ['ISSUED', 'OVERDUE'] } },
        data: { status: 'VOID' },
      });
    }
  });

  return true;
}
