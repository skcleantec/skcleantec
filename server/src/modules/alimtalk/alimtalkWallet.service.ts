import { randomBytes } from 'node:crypto';
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
import { recordWalletUsage } from '../wallet/walletUsageLog.js';

export type AlimtalkWalletView = {
  prepaidBalanceKrw: number;
  monthlyFreeUsed: number;
  monthlyFreePeriodYm: string;
  monthlyFreeEnabled: boolean;
  monthlyFreeUnlimited: boolean;
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
  const unlimited = wallet.monthlyFreeUnlimited === true;
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
    monthlyFreeUnlimited: unlimited,
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
  if (wallet.monthlyFreeUnlimited) {
    return { ok: true, wallet };
  }
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
  refId: string;
}): Promise<{ chargeStatus: 'FREE' | 'PAID'; freeUnitsConsumed: number; tenantUnitPriceKrw: number }> {
  const wallet = await getAlimtalkWalletView(params.tenantId, params.plan);
  const needFree = params.channel === 'LMS' ? ALIMTALK_LMS_FREE_UNITS : 1;
  const unitPrice =
    params.channel === 'LMS' ? ALIMTALK_UNIT_PRICE_LMS_KRW : ALIMTALK_UNIT_PRICE_ATA_KRW;

  if (wallet.monthlyFreeUnlimited || wallet.monthlyFreeRemaining >= needFree) {
    await prisma.tenantAlimtalkWallet.update({
      where: { tenantId: params.tenantId },
      data: { monthlyFreeUsed: wallet.monthlyFreeUsed + needFree },
    });
    return { chargeStatus: 'FREE', freeUnitsConsumed: needFree, tenantUnitPriceKrw: 0 };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.tenantAlimtalkWallet.update({
      where: { tenantId: params.tenantId },
      data: { prepaidBalanceKrw: { decrement: unitPrice } },
    });
    await recordWalletUsage(tx, {
      tenantId: params.tenantId,
      type: 'ALIMTALK',
      refId: params.refId,
      amountKrw: -unitPrice,
      balanceAfterKrw: updated.prepaidBalanceKrw,
    });
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

export const PLATFORM_WALLET_ADJUST_MAX_KRW = 1_000_000;
export type PlatformWalletAdjustKind = 'paid' | 'grant' | 'clawback';

export function validatePlatformWalletAdjustKrw(amount: number): string | null {
  if (!Number.isInteger(amount) || amount < 1 || amount > PLATFORM_WALLET_ADJUST_MAX_KRW) {
    return '금액은 1원 이상 1,000,000원 이하로 입력해 주세요.';
  }
  return null;
}

export function walletChargePresentation(memo: string | null): {
  kind: PlatformWalletAdjustKind | 'card' | 'other';
  reason: string | null;
  tenantLabel: string;
} {
  if (memo?.startsWith('cbiseo:paid:')) {
    return { kind: 'paid', reason: memo.slice('cbiseo:paid:'.length) || null, tenantLabel: '청소비서 지급' };
  }
  if (memo?.startsWith('cbiseo:grant:')) {
    return { kind: 'grant', reason: memo.slice('cbiseo:grant:'.length) || null, tenantLabel: '청소비서 지급' };
  }
  if (memo?.startsWith('cbiseo:clawback:')) {
    return { kind: 'clawback', reason: memo.slice('cbiseo:clawback:'.length) || null, tenantLabel: '청소비서 회수' };
  }
  if (memo?.startsWith('card:')) return { kind: 'card', reason: null, tenantLabel: '카드 충전' };
  return { kind: 'other', reason: memo, tenantLabel: '충전' };
}

export type AlimtalkWalletChargeLogView = {
  id: string;
  amountKrw: number;
  balanceAfterKrw: number;
  memo: string | null;
  createdAt: Date;
  actorName: string | null;
  kind: ReturnType<typeof walletChargePresentation>['kind'];
  reason: string | null;
  tenantLabel: string;
};

export async function listRecentAlimtalkChargeLogs(
  tenantId: string,
  limit = 10,
): Promise<AlimtalkWalletChargeLogView[]> {
  const rows = await prisma.alimtalkWalletChargeLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      amountKrw: true,
      balanceAfterKrw: true,
      memo: true,
      createdAt: true,
      actorPlatformUserId: true,
    },
  });
  const actorIds = [...new Set(rows.map((row) => row.actorPlatformUserId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await prisma.platformUser.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(actors.map((actor) => [actor.id, actor.name]));
  return rows.map((row) => {
    const shown = walletChargePresentation(row.memo);
    return {
      id: row.id,
      amountKrw: row.amountKrw,
      balanceAfterKrw: row.balanceAfterKrw,
      memo: shown.reason,
      createdAt: row.createdAt,
      actorName: row.actorPlatformUserId ? names.get(row.actorPlatformUserId) ?? null : null,
      kind: shown.kind,
      reason: shown.reason,
      tenantLabel: shown.tenantLabel,
    };
  });
}

async function recordPaidWalletDeposit(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: { tenantId: string; amountKrw: number; reason: string | null; actorPlatformUserId: string | null },
): Promise<void> {
  await tx.usageFeeCardPayment.create({
    data: {
      purpose: 'OTHER',
      payMethod: 'BANK',
      status: 'APPROVED',
      tenantId: params.tenantId,
      goodsName: '청소비서 지갑',
      supplyAmountKrw: params.amountKrw,
      vatAmountKrw: 0,
      amountKrw: params.amountKrw,
      pgOrderId: `wlt${randomBytes(12).toString('hex')}`,
      memo: params.reason || '입금 확인',
      invoiceApplied: true,
      paidAt: new Date(),
      createdByPlatformUserId: params.actorPlatformUserId,
    },
  });
}

export async function applyPlatformAlimtalkTopUp(params: {
  tenantId: string;
  amountKrw: number;
  memo?: string | null;
  actorPlatformUserId?: string | null;
  /** 입금 확인(유상)이면 입금 내역에 통장 건으로 남긴다. */
  revenue?: boolean;
}): Promise<{ balanceAfterKrw: number; logId: string }> {
  const validationError = params.memo?.startsWith('cbiseo:')
    ? validatePlatformWalletAdjustKrw(params.amountKrw)
    : validateAlimtalkTopUpAmountKrw(params.amountKrw);
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
    if (params.revenue) {
      const shown = walletChargePresentation(params.memo ?? null);
      await recordPaidWalletDeposit(tx, {
        tenantId: params.tenantId,
        amountKrw: params.amountKrw,
        reason: shown.reason,
        actorPlatformUserId: params.actorPlatformUserId ?? null,
      });
    }
    return { balanceAfterKrw: wallet.prepaidBalanceKrw, logId: log.id };
  });
}

export async function applyPlatformWalletClawback(params: {
  tenantId: string;
  amountKrw: number;
  reason: string;
  actorPlatformUserId?: string | null;
}): Promise<{ balanceAfterKrw: number }> {
  const validationError = validatePlatformWalletAdjustKrw(params.amountKrw);
  if (validationError) throw new Error(validationError);
  const reason = params.reason.trim();
  if (!reason) throw new Error('회수 사유를 입력해 주세요.');
  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId }, select: { plan: true } });
  if (!tenant) throw new Error('Tenant not found');
  await ensureTenantAlimtalkDefaults(params.tenantId, tenant.plan);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.tenantAlimtalkWallet.updateMany({
      where: { tenantId: params.tenantId, prepaidBalanceKrw: { gte: params.amountKrw } },
      data: { prepaidBalanceKrw: { decrement: params.amountKrw } },
    });
    if (updated.count !== 1) throw new Error('잔액보다 많이 회수할 수 없습니다.');
    const wallet = await tx.tenantAlimtalkWallet.findUnique({
      where: { tenantId: params.tenantId },
      select: { prepaidBalanceKrw: true },
    });
    await tx.alimtalkWalletChargeLog.create({
      data: {
        tenantId: params.tenantId,
        amountKrw: -params.amountKrw,
        balanceAfterKrw: wallet?.prepaidBalanceKrw ?? 0,
        memo: `cbiseo:clawback:${reason}`,
        actorPlatformUserId: params.actorPlatformUserId ?? null,
      },
    });
    return { balanceAfterKrw: wallet?.prepaidBalanceKrw ?? 0 };
  });
}

/** 카드 승인 통지가 여러 번 와도 같은 주문번호는 잔액을 한 번만 올린다. */
export async function creditWalletFromCardOnce(params: {
  tenantId: string;
  amountKrw: number;
  pgOrderId: string;
}): Promise<{ already: boolean }> {
  const validationError = validateAlimtalkTopUpAmountKrw(params.amountKrw);
  if (validationError) throw new Error(validationError);
  const memo = `card:${params.pgOrderId}`;
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error('Tenant not found');
  await ensureTenantAlimtalkDefaults(params.tenantId, tenant.plan);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.alimtalkWalletChargeLog.findFirst({
      where: { tenantId: params.tenantId, memo },
      select: { id: true },
    });
    if (existing) return { already: true };
    const wallet = await tx.tenantAlimtalkWallet.update({
      where: { tenantId: params.tenantId },
      data: { prepaidBalanceKrw: { increment: params.amountKrw } },
    });
    await tx.alimtalkWalletChargeLog.create({
      data: {
        tenantId: params.tenantId,
        amountKrw: params.amountKrw,
        balanceAfterKrw: wallet.prepaidBalanceKrw,
        memo,
      },
    });
    return { already: false };
  });
}

/** 카드 취소 통지가 여러 번 와도 같은 주문번호는 잔액을 한 번만 되돌린다. */
export async function reverseWalletCardOnce(params: {
  tenantId: string;
  amountKrw: number;
  pgOrderId: string;
}): Promise<void> {
  const creditMemo = `card:${params.pgOrderId}`;
  const cancelMemo = `card-cancel:${params.pgOrderId}`;
  await prisma.$transaction(async (tx) => {
    const credit = await tx.alimtalkWalletChargeLog.findFirst({
      where: { tenantId: params.tenantId, memo: creditMemo },
      select: { id: true },
    });
    if (!credit) return;
    const cancel = await tx.alimtalkWalletChargeLog.findFirst({
      where: { tenantId: params.tenantId, memo: cancelMemo },
      select: { id: true },
    });
    if (cancel) return;
    const claimed = await tx.tenantAlimtalkWallet.updateMany({
      where: { tenantId: params.tenantId, prepaidBalanceKrw: { gte: params.amountKrw } },
      data: { prepaidBalanceKrw: { decrement: params.amountKrw } },
    });
    if (claimed.count !== 1) {
      throw new Error('잔액을 이미 사용해 카드 취소를 반영할 수 없습니다.');
    }
    const wallet = await tx.tenantAlimtalkWallet.findUnique({
      where: { tenantId: params.tenantId },
      select: { prepaidBalanceKrw: true },
    });
    await tx.alimtalkWalletChargeLog.create({
      data: {
        tenantId: params.tenantId,
        amountKrw: -params.amountKrw,
        balanceAfterKrw: wallet?.prepaidBalanceKrw ?? 0,
        memo: cancelMemo,
      },
    });
  });
}
