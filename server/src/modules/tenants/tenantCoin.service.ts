import type { InquiryStatus, Prisma, TenantCoinLedgerSourceType } from '@prisma/client';
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

/** 예약금 대기(DEPOSIT_PENDING) 이후 업무 상태 — 진입 시마다 1코인 (상태·발급별 1회) */
export const COIN_CHARGE_INQUIRY_STATUSES: ReadonlySet<InquiryStatus> = new Set([
  'DEPOSIT_PENDING',
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CS_PROCESSING',
]);

export function isCoinChargeInquiryStatus(status: InquiryStatus): boolean {
  return COIN_CHARGE_INQUIRY_STATUSES.has(status);
}

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
    sourceType: TenantCoinLedgerSourceType;
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

/** @deprecated 레거시 원장(INQUIRY_DEPOSIT_PENDING) 호환 — 신규는 chargeInquiryStatusCoinInTx 사용 */
export async function chargeInquiryDepositPendingCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; inquiryId: string },
): Promise<void> {
  await chargeInquiryStatusCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    inquiryId: opts.inquiryId,
    status: 'DEPOSIT_PENDING',
  });
}

export async function chargeInquiryStatusCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; inquiryId: string; status: InquiryStatus },
): Promise<void> {
  if (!isCoinChargeInquiryStatus(opts.status)) return;

  await trySpendTenantCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    sourceType: 'INQUIRY_STATUS',
    sourceId: `${opts.inquiryId}:${opts.status}`,
  });
}

export async function chargeOrderFormIssueCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; orderFormId: string },
): Promise<void> {
  await trySpendTenantCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    sourceType: 'ORDER_FORM_ISSUE',
    sourceId: opts.orderFormId,
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
