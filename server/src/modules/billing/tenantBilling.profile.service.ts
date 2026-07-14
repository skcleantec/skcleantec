import type {
  TenantBillingAdjustmentType,
  TenantBillingCycle,
  TenantBillingPricingMode,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { TENANT_BILLING_DEFAULT_DUE_DAY } from './tenantBilling.constants.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';
import { parseYmdToUtcDate } from '../users/userEmployment.js';
import { kstDayOfMonthFromDate } from './tenantBilling.dates.js';

export type BillingProfileDto = {
  billingCycle: TenantBillingCycle;
  pricingMode: TenantBillingPricingMode;
  customMonthlyAmountKrw: number | null;
  customAnnualAmountKrw: number | null;
  billingDueDay: number;
  billingStartDate: string | null;
  autoIssueEnabled: boolean;
  contractMemo: string | null;
};

export type BillingAdjustmentDto = {
  id: string;
  type: TenantBillingAdjustmentType;
  targetPeriodStart: string;
  customAmountKrw: number | null;
  reason: string;
  voidedAt: string | null;
  createdAt: string;
};

export function mapBillingProfile(row: {
  billingCycle: TenantBillingCycle;
  pricingMode: TenantBillingPricingMode;
  customMonthlyAmountKrw: number | null;
  customAnnualAmountKrw: number | null;
  billingDueDay: number;
  billingStartDate: Date | null;
  autoIssueEnabled: boolean;
  contractMemo: string | null;
}): BillingProfileDto {
  return {
    billingCycle: row.billingCycle,
    pricingMode: row.pricingMode,
    customMonthlyAmountKrw: row.customMonthlyAmountKrw,
    customAnnualAmountKrw: row.customAnnualAmountKrw,
    billingDueDay: row.billingDueDay,
    billingStartDate: row.billingStartDate?.toISOString() ?? null,
    autoIssueEnabled: row.autoIssueEnabled,
    contractMemo: row.contractMemo,
  };
}

export async function ensureTenantBillingProfile(tenantId: string, cycle: TenantBillingCycle = 'MONTHLY') {
  return prisma.tenantBillingProfile.upsert({
    where: { tenantId },
    create: {
      tenantId,
      billingCycle: cycle,
      billingDueDay: TENANT_BILLING_DEFAULT_DUE_DAY,
    },
    update: {},
  });
}

export async function getTenantBillingCycle(tenantId: string): Promise<TenantBillingCycle> {
  const profile = await ensureTenantBillingProfile(tenantId);
  return profile.billingCycle;
}

export async function updateTenantBillingProfileContract(
  tenantId: string,
  input: {
    billingCycle?: TenantBillingCycle;
    pricingMode?: TenantBillingPricingMode;
    customMonthlyAmountKrw?: number | null;
    customAnnualAmountKrw?: number | null;
    billingDueDay?: number;
    billingStartDate?: string | null;
    autoIssueEnabled?: boolean;
    contractMemo?: string | null;
  },
): Promise<BillingProfileDto> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, serviceStartedAt: true, status: true, suspendReason: true },
  });
  if (!tenant) throw new TenantNotFoundError();

  if (input.billingDueDay !== undefined) {
    const d = Math.floor(input.billingDueDay);
    if (!Number.isFinite(d) || d < 1 || d > 28) {
      throw new Error('납부 기준일은 1~28 사이여야 합니다.');
    }
  }

  if (input.customMonthlyAmountKrw != null) {
    const n = Math.trunc(input.customMonthlyAmountKrw);
    if (n < 0 || n > 100_000_000) {
      throw new Error('약정 월 금액은 0 이상 정수여야 합니다.');
    }
  }
  if (input.customAnnualAmountKrw != null) {
    const n = Math.trunc(input.customAnnualAmountKrw);
    if (n < 0 || n > 1_000_000_000) {
      throw new Error('약정 연 금액은 0 이상 정수여야 합니다.');
    }
  }

  let billingStartDate: Date | null | undefined;
  if (input.billingStartDate !== undefined) {
    if (input.billingStartDate === null || String(input.billingStartDate).trim() === '') {
      billingStartDate = null;
    } else {
      const d = parseYmdToUtcDate(String(input.billingStartDate).trim());
      if (!d) throw new Error('과금 시작일은 YYYY-MM-DD 형식이어야 합니다.');
      billingStartDate = d;
    }
  }

  const profile = await prisma.tenantBillingProfile.upsert({
    where: { tenantId },
    create: {
      tenantId,
      billingCycle: input.billingCycle ?? 'MONTHLY',
      pricingMode: input.pricingMode ?? 'CATALOG',
      customMonthlyAmountKrw: input.customMonthlyAmountKrw ?? null,
      customAnnualAmountKrw: input.customAnnualAmountKrw ?? null,
      billingDueDay: input.billingDueDay ?? TENANT_BILLING_DEFAULT_DUE_DAY,
      billingStartDate: billingStartDate ?? tenant.serviceStartedAt ?? null,
      autoIssueEnabled: input.autoIssueEnabled ?? true,
      contractMemo: input.contractMemo?.trim() || null,
    },
    update: {
      ...(input.billingCycle !== undefined ? { billingCycle: input.billingCycle } : {}),
      ...(input.pricingMode !== undefined ? { pricingMode: input.pricingMode } : {}),
      ...(input.customMonthlyAmountKrw !== undefined
        ? { customMonthlyAmountKrw: input.customMonthlyAmountKrw }
        : {}),
      ...(input.customAnnualAmountKrw !== undefined
        ? { customAnnualAmountKrw: input.customAnnualAmountKrw }
        : {}),
      ...(input.billingDueDay !== undefined ? { billingDueDay: Math.floor(input.billingDueDay) } : {}),
      ...(billingStartDate !== undefined ? { billingStartDate } : {}),
      ...(billingStartDate != null && billingStartDate !== undefined
        ? { billingDueDay: kstDayOfMonthFromDate(billingStartDate) }
        : {}),
      ...(input.autoIssueEnabled !== undefined ? { autoIssueEnabled: input.autoIssueEnabled } : {}),
      ...(input.contractMemo !== undefined ? { contractMemo: input.contractMemo?.trim() || null } : {}),
    },
  });

  const effectiveBillingStart =
    billingStartDate !== undefined
      ? billingStartDate
      : profile.billingStartDate;

  if (effectiveBillingStart && !tenant.serviceStartedAt) {
    const anchorDay = kstDayOfMonthFromDate(effectiveBillingStart);
    await prisma.tenantBillingProfile.update({
      where: { tenantId },
      data: { billingDueDay: anchorDay },
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        serviceStartedAt: effectiveBillingStart,
        ...(tenant.status === 'SUSPENDED' && tenant.suspendReason === 'TRIAL_EXPIRED'
          ? {
              status: 'ACTIVE',
              suspendReason: null,
              suspendedAt: null,
              billingAccessBlockedAt: null,
            }
          : {}),
      },
    });
  }

  return mapBillingProfile(profile);
}

/** @deprecated cycle only — use updateTenantBillingProfileContract */
export async function updateTenantBillingProfile(
  tenantId: string,
  billingCycle: TenantBillingCycle,
): Promise<{ billingCycle: TenantBillingCycle }> {
  const profile = await updateTenantBillingProfileContract(tenantId, { billingCycle });
  return { billingCycle: profile.billingCycle };
}

export async function listTenantBillingAdjustments(tenantId: string): Promise<BillingAdjustmentDto[]> {
  const rows = await prisma.tenantBillingAdjustment.findMany({
    where: { tenantId, voidedAt: null },
    orderBy: { targetPeriodStart: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    targetPeriodStart: r.targetPeriodStart.toISOString(),
    customAmountKrw: r.customAmountKrw,
    reason: r.reason,
    voidedAt: r.voidedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createTenantBillingAdjustment(
  tenantId: string,
  platformUserId: string,
  input: {
    type: TenantBillingAdjustmentType;
    targetPeriodStart: string;
    customAmountKrw?: number | null;
    reason: string;
  },
): Promise<BillingAdjustmentDto> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw new TenantNotFoundError();

  const reason = input.reason.trim();
  if (!reason) throw new Error('사유를 입력해 주세요.');

  const target = parseYmdToUtcDate(input.targetPeriodStart.trim());
  if (!target) throw new Error('대상 기간 시작일은 YYYY-MM-DD 형식이어야 합니다.');

  if (input.type === 'CUSTOM_AMOUNT') {
    if (input.customAmountKrw == null || !Number.isFinite(input.customAmountKrw)) {
      throw new Error('1회 금액 변경 시 금액을 입력해 주세요.');
    }
    if (input.customAmountKrw < 0) throw new Error('금액은 0 이상이어야 합니다.');
  }

  const existing = await prisma.tenantBillingAdjustment.findFirst({
    where: {
      tenantId,
      voidedAt: null,
      targetPeriodStart: target,
    },
  });
  if (existing) {
    throw new Error('해당 이용 기간에 이미 활성 예외가 있습니다. 취소 후 다시 등록해 주세요.');
  }

  const row = await prisma.tenantBillingAdjustment.create({
    data: {
      tenantId,
      type: input.type,
      targetPeriodStart: target,
      customAmountKrw:
        input.type === 'CUSTOM_AMOUNT' ? Math.trunc(input.customAmountKrw!) : null,
      reason,
      createdByPlatformUserId: platformUserId,
    },
  });

  return {
    id: row.id,
    type: row.type,
    targetPeriodStart: row.targetPeriodStart.toISOString(),
    customAmountKrw: row.customAmountKrw,
    reason: row.reason,
    voidedAt: null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function voidTenantBillingAdjustment(tenantId: string, adjustmentId: string): Promise<void> {
  const row = await prisma.tenantBillingAdjustment.findFirst({
    where: { id: adjustmentId, tenantId, voidedAt: null },
  });
  if (!row) throw new Error('취소할 예외를 찾을 수 없습니다.');
  await prisma.tenantBillingAdjustment.update({
    where: { id: adjustmentId },
    data: { voidedAt: new Date() },
  });
}

export async function resolveBillingStartDate(
  tenantId: string,
): Promise<{ billingStart: Date | null; profile: BillingProfileDto }> {
  const [tenant, profileRow] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { serviceStartedAt: true },
    }),
    ensureTenantBillingProfile(tenantId),
  ]);
  if (!tenant) throw new TenantNotFoundError();
  const profile = mapBillingProfile(profileRow);
  const billingStart = profile.billingStartDate
    ? new Date(profile.billingStartDate)
    : tenant.serviceStartedAt;
  return { billingStart, profile };
}
