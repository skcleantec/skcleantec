import { prisma } from '../../lib/prisma.js';
import {
  ALIMTALK_LMS_FREE_UNITS,
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_UNIT_PRICE_ATA_KRW,
  ALIMTALK_UNIT_PRICE_LMS_KRW,
  alimtalkMonthlyFreeQuotaForPlan,
  validateAlimtalkTopUpAmountKrw,
  type AlimtalkTemplateCode,
} from '../../lib/alimtalkPolicy.js';
import { kstYm } from './alimtalkKst.js';
import { ALIMTALK_TEMPLATE_SEED, solapiTemplateIdFromEnv } from './alimtalkSolapi.client.js';

export type AlimtalkWalletView = {
  prepaidBalanceKrw: number;
  monthlyFreeUsed: number;
  monthlyFreePeriodYm: string;
  monthlyFreeEnabled: boolean;
  monthlyFreeQuota: number;
  monthlyFreeRemaining: number;
};

export async function ensureAlimtalkPlatformTemplates(): Promise<void> {
  for (const row of ALIMTALK_TEMPLATE_SEED) {
    const envId = solapiTemplateIdFromEnv(row.code);
    if (!envId) continue;
    await prisma.alimtalkTemplate.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        solapiTemplateId: envId,
        name: row.name,
        triggerType: row.triggerType,
        isActive: true,
      },
      update: {
        solapiTemplateId: envId,
        name: row.name,
        triggerType: row.triggerType,
        isActive: true,
      },
    });
  }
}

export async function ensureTenantAlimtalkDefaults(tenantId: string, plan: string): Promise<void> {
  const ym = kstYm();
  await prisma.tenantAlimtalkWallet.upsert({
    where: { tenantId },
    create: {
      tenantId,
      monthlyFreePeriodYm: ym,
      monthlyFreeUsed: 0,
      monthlyFreeEnabled: alimtalkMonthlyFreeQuotaForPlan(plan) > 0,
    },
    update: {},
  });
  for (const code of ALIMTALK_TEMPLATE_CODES) {
    await prisma.tenantAlimtalkTemplateSetting.upsert({
      where: { tenantId_templateCode: { tenantId, templateCode: code } },
      create: { tenantId, templateCode: code, isEnabled: true },
      update: {},
    });
  }
}

async function resetMonthlyFreeIfNeeded(
  tenantId: string,
  plan: string,
  wallet: { monthlyFreePeriodYm: string; monthlyFreeUsed: number; monthlyFreeEnabled: boolean },
): Promise<{ monthlyFreePeriodYm: string; monthlyFreeUsed: number }> {
  const ym = kstYm();
  if (wallet.monthlyFreePeriodYm === ym) {
    return { monthlyFreePeriodYm: wallet.monthlyFreePeriodYm, monthlyFreeUsed: wallet.monthlyFreeUsed };
  }
  await prisma.tenantAlimtalkWallet.update({
    where: { tenantId },
    data: { monthlyFreePeriodYm: ym, monthlyFreeUsed: 0 },
  });
  return { monthlyFreePeriodYm: ym, monthlyFreeUsed: 0 };
}

export async function getAlimtalkWalletView(tenantId: string, plan: string): Promise<AlimtalkWalletView> {
  await ensureTenantAlimtalkDefaults(tenantId, plan);
  const wallet = await prisma.tenantAlimtalkWallet.findUniqueOrThrow({ where: { tenantId } });
  const reset = await resetMonthlyFreeIfNeeded(tenantId, plan, wallet);
  const quota =
    wallet.monthlyFreeEnabled && alimtalkMonthlyFreeQuotaForPlan(plan) > 0
      ? alimtalkMonthlyFreeQuotaForPlan(plan)
      : 0;
  const remaining = Math.max(0, quota - reset.monthlyFreeUsed);
  return {
    prepaidBalanceKrw: wallet.prepaidBalanceKrw,
    monthlyFreeUsed: reset.monthlyFreeUsed,
    monthlyFreePeriodYm: reset.monthlyFreePeriodYm,
    monthlyFreeEnabled: wallet.monthlyFreeEnabled,
    monthlyFreeQuota: quota,
    monthlyFreeRemaining: remaining,
  };
}

export type AlimtalkPreflightResult =
  | { ok: true; wallet: AlimtalkWalletView }
  | { ok: false; error: string };

export async function preflightAlimtalkSend(
  tenantId: string,
  plan: string,
  channel: 'ATA' | 'LMS',
): Promise<AlimtalkPreflightResult> {
  const wallet = await getAlimtalkWalletView(tenantId, plan);
  const needFree = channel === 'LMS' ? ALIMTALK_LMS_FREE_UNITS : 1;
  const needPaid = channel === 'LMS' ? ALIMTALK_UNIT_PRICE_LMS_KRW : ALIMTALK_UNIT_PRICE_ATA_KRW;
  if (wallet.monthlyFreeRemaining >= needFree) {
    return { ok: true, wallet };
  }
  if (wallet.prepaidBalanceKrw >= needPaid) {
    return { ok: true, wallet };
  }
  return {
    ok: false,
    error: '알림톡 월 무료 건수와 충전 잔액이 부족합니다. 플랫폼에 충전을 요청해 주세요.',
  };
}

export async function applyAlimtalkCharge(params: {
  tenantId: string;
  plan: string;
  channel: 'ATA' | 'LMS';
}): Promise<{ chargeStatus: 'FREE' | 'PAID'; freeUnitsConsumed: number; tenantUnitPriceKrw: number }> {
  const wallet = await getAlimtalkWalletView(params.tenantId, params.plan);
  const needFree = params.channel === 'LMS' ? ALIMTALK_LMS_FREE_UNITS : 1;
  const unitPrice =
    params.channel === 'LMS' ? ALIMTALK_UNIT_PRICE_LMS_KRW : ALIMTALK_UNIT_PRICE_ATA_KRW;

  if (wallet.monthlyFreeRemaining >= needFree) {
    await prisma.tenantAlimtalkWallet.update({
      where: { tenantId: params.tenantId },
      data: { monthlyFreeUsed: wallet.monthlyFreeUsed + needFree },
    });
    return { chargeStatus: 'FREE', freeUnitsConsumed: needFree, tenantUnitPriceKrw: 0 };
  }

  await prisma.tenantAlimtalkWallet.update({
    where: { tenantId: params.tenantId },
    data: { prepaidBalanceKrw: { decrement: unitPrice } },
  });
  return { chargeStatus: 'PAID', freeUnitsConsumed: 0, tenantUnitPriceKrw: unitPrice };
}

export async function resolveSolapiTemplateId(code: AlimtalkTemplateCode): Promise<string | null> {
  await ensureAlimtalkPlatformTemplates();
  const row = await prisma.alimtalkTemplate.findUnique({ where: { code, isActive: true } });
  if (row?.solapiTemplateId) return row.solapiTemplateId;
  return solapiTemplateIdFromEnv(code);
}

export async function isTenantAlimtalkTemplateEnabled(
  tenantId: string,
  code: AlimtalkTemplateCode,
): Promise<boolean> {
  const row = await prisma.tenantAlimtalkTemplateSetting.findUnique({
    where: { tenantId_templateCode: { tenantId, templateCode: code } },
  });
  return row?.isEnabled !== false;
}

export type AlimtalkWalletChargeLogView = {
  id: string;
  amountKrw: number;
  balanceAfterKrw: number;
  memo: string | null;
  createdAt: Date;
};

export async function listRecentAlimtalkChargeLogs(
  tenantId: string,
  limit = 10,
): Promise<AlimtalkWalletChargeLogView[]> {
  return prisma.alimtalkWalletChargeLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      amountKrw: true,
      balanceAfterKrw: true,
      memo: true,
      createdAt: true,
    },
  });
}

export async function applyPlatformAlimtalkTopUp(params: {
  tenantId: string;
  amountKrw: number;
  memo?: string | null;
  actorPlatformUserId?: string | null;
}): Promise<{ balanceAfterKrw: number; logId: string }> {
  const validationError = validateAlimtalkTopUpAmountKrw(params.amountKrw);
  if (validationError) throw new Error(validationError);

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  await ensureTenantAlimtalkDefaults(params.tenantId, tenant.plan);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.tenantAlimtalkWallet.update({
      where: { tenantId: params.tenantId },
      data: { prepaidBalanceKrw: { increment: params.amountKrw } },
    });
    const log = await tx.alimtalkWalletChargeLog.create({
      data: {
        tenantId: params.tenantId,
        amountKrw: params.amountKrw,
        balanceAfterKrw: wallet.prepaidBalanceKrw,
        memo: params.memo?.trim() || null,
        actorPlatformUserId: params.actorPlatformUserId ?? null,
      },
    });
    return { balanceAfterKrw: wallet.prepaidBalanceKrw, logId: log.id };
  });
}
