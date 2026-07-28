import type { Prisma } from '@prisma/client';
import { kstYmdFromDate } from '../billing/tenantBilling.dates.js';
import {
  monthlyCoinAllowance,
  planHasUnlimitedCoins,
  normalizePlanId,
} from './tenantFeatureCatalog.js';

export class TenantCoinInsufficientError extends Error {
  readonly status = 402;
  constructor(message = '이번 달 이용 코인이 부족합니다. 플랜 업그레이드 또는 다음 달 리셋을 기다려 주세요.') {
    super(message);
    this.name = 'TenantCoinInsufficientError';
  }
}

export type TenantCoinSourceType = 'INQUIRY_DEPOSIT_PENDING' | 'DB_MARKETPLACE_PURCHASE';

export function kstPeriodYmFromDate(d = new Date()): string {
  return kstYmdFromDate(d).slice(0, 7);
}

type Db = Prisma.TransactionClient | typeof import('../../lib/prisma.js').prisma;

export async function countCoinsSpentInPeriod(
  db: Db,
  tenantId: string,
  periodYm: string,
): Promise<number> {
  const agg = await db.tenantCoinLedgerEntry.aggregate({
    where: { tenantId, periodYm },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export async function getTenantCoinSnapshot(
  db: Db,
  tenantId: string,
  plan: string,
  periodYm = kstPeriodYmFromDate(),
): Promise<{ periodYm: string; allowance: number | null; spent: number; remaining: number | null; unlimited: boolean }> {
  const unlimited = planHasUnlimitedCoins(plan);
  const allowance = monthlyCoinAllowance(plan);
  const spent = unlimited ? 0 : await countCoinsSpentInPeriod(db, tenantId, periodYm);
  const remaining = unlimited || allowance == null ? null : Math.max(0, allowance - spent);
  return { periodYm, allowance, spent, remaining, unlimited };
}

export async function trySpendTenantCoinInTx(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string;
    plan: string;
    sourceType: TenantCoinSourceType;
    sourceId: string;
    amount?: number;
    periodYm?: string;
  },
): Promise<{ charged: boolean; alreadyRecorded: boolean }> {
  const plan = normalizePlanId(opts.plan);
  const amount = opts.amount ?? 1;
  const periodYm = opts.periodYm ?? kstPeriodYmFromDate();

  if (planHasUnlimitedCoins(plan)) {
    return { charged: false, alreadyRecorded: false };
  }

  const existing = await tx.tenantCoinLedgerEntry.findUnique({
    where: {
      tenantId_sourceType_sourceId: {
        tenantId: opts.tenantId,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId,
      },
    },
    select: { id: true },
  });
  if (existing) return { charged: false, alreadyRecorded: true };

  const allowance = monthlyCoinAllowance(plan);
  if (allowance == null) return { charged: false, alreadyRecorded: false };

  const spent = await countCoinsSpentInPeriod(tx, opts.tenantId, periodYm);
  if (spent + amount > allowance) {
    throw new TenantCoinInsufficientError();
  }

  await tx.tenantCoinLedgerEntry.create({
    data: {
      tenantId: opts.tenantId,
      periodYm,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
      amount,
    },
  });
  return { charged: true, alreadyRecorded: false };
}

export async function chargeInquiryDepositPendingCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; inquiryId: string },
): Promise<void> {
  const followupLinked = await tx.orderFollowup.findFirst({
    where: { tenantId: opts.tenantId, inquiryId: opts.inquiryId },
    select: { id: true },
  });
  if (followupLinked) return;

  await trySpendTenantCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    sourceType: 'INQUIRY_DEPOSIT_PENDING',
    sourceId: opts.inquiryId,
  });
}

export async function chargeDbMarketplacePurchaseCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; listingId: string },
): Promise<void> {
  await trySpendTenantCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    sourceType: 'DB_MARKETPLACE_PURCHASE',
    sourceId: opts.listingId,
  });
}

export function mapTenantCoinError(e: unknown): { status: number; message: string } | null {
  if (e instanceof TenantCoinInsufficientError) {
    return { status: e.status, message: e.message };
  }
  return null;
}
