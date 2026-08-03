import type { InquiryStatus, Prisma } from '@prisma/client';
import { kstYmdFromDate } from '../billing/tenantBilling.dates.js';
import { prisma } from '../../lib/prisma.js';
import {
  monthlyCoinAllowance,
  planHasUnlimitedCoins,
  normalizePlanId,
} from './tenantFeatureCatalog.js';
import { isSignupCoinGraceActive, readSignupCoinGraceEndsAt } from './tenantSignupGrace.js';

export class TenantCoinInsufficientError extends Error {
  readonly status = 402;
  constructor(message = '이번 달 이용 코인이 부족합니다. 플랜 업그레이드 또는 다음 달 리셋을 기다려 주세요.') {
    super(message);
    this.name = 'TenantCoinInsufficientError';
  }
}

/** 발주·예약금 대기 등 과금 대상 상태 — 진입 시 chargeInquiryCoinInTx 시도(접수당 1회만 실제 차감) */
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

async function tenantCoinUnlimited(db: Db, tenantId: string, plan: string): Promise<boolean> {
  if (planHasUnlimitedCoins(plan)) return true;
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true, trialEndsAt: true, status: true },
  });
  return isSignupCoinGraceActive(tenant ?? {});
}

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
): Promise<{
  periodYm: string;
  allowance: number | null;
  spent: number;
  remaining: number | null;
  unlimited: boolean;
  graceActive: boolean;
  graceEndsAt: string | null;
}> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { config: true, trialEndsAt: true, status: true },
  });
  const graceActive = isSignupCoinGraceActive(tenant ?? {});
  const graceEndsAt =
    readSignupCoinGraceEndsAt(tenant?.config) ??
    (tenant?.trialEndsAt ? tenant.trialEndsAt.toISOString() : null);
  const unlimited = planHasUnlimitedCoins(plan) || graceActive;
  const allowance = monthlyCoinAllowance(plan);
  // Premium·가입 grace도 원장에 쌓인 실제 사용량을 집계 (플랫폼/운영 가시성)
  const spent = await countCoinsSpentInPeriod(db, tenantId, periodYm);
  const remaining = unlimited || allowance == null ? null : Math.max(0, allowance - spent);
  return { periodYm, allowance, spent, remaining, unlimited, graceActive, graceEndsAt };
}

export async function trySpendTenantCoinInTx(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string;
    plan: string;
    sourceType: import('@prisma/client').TenantCoinLedgerSourceType;
    sourceId: string;
    amount?: number;
    periodYm?: string;
  },
): Promise<{ charged: boolean; alreadyRecorded: boolean }> {
  const plan = normalizePlanId(opts.plan);
  const amount = opts.amount ?? 1;
  const periodYm = opts.periodYm ?? kstPeriodYmFromDate();

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

  const unlimited = await tenantCoinUnlimited(tx, opts.tenantId, plan);
  // 무제한·grace는 한도 검사만 생략하고, 사용량 원장은 항상 기록한다.
  if (!unlimited) {
    const allowance = monthlyCoinAllowance(plan);
    if (allowance != null) {
      const spent = await countCoinsSpentInPeriod(tx, opts.tenantId, periodYm);
      if (spent + amount > allowance) {
        throw new TenantCoinInsufficientError();
      }
    }
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

/** 이전 원장(발급·상태별·입금대기)까지 포함해 접수당 1회만 차감됐는지 */
async function inquiryCoinAlreadyRecordedInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  inquiryId: string,
): Promise<boolean> {
  const inquiryEntry = await tx.tenantCoinLedgerEntry.findUnique({
    where: {
      tenantId_sourceType_sourceId: {
        tenantId,
        sourceType: 'INQUIRY',
        sourceId: inquiryId,
      },
    },
    select: { id: true },
  });
  if (inquiryEntry) return true;

  const legacyDeposit = await tx.tenantCoinLedgerEntry.findUnique({
    where: {
      tenantId_sourceType_sourceId: {
        tenantId,
        sourceType: 'INQUIRY_DEPOSIT_PENDING',
        sourceId: inquiryId,
      },
    },
    select: { id: true },
  });
  if (legacyDeposit) return true;

  const legacyStatus = await tx.tenantCoinLedgerEntry.findFirst({
    where: {
      tenantId,
      sourceType: 'INQUIRY_STATUS',
      sourceId: { startsWith: `${inquiryId}:` },
    },
    select: { id: true },
  });
  if (legacyStatus) return true;

  const inquiry = await tx.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: { orderFormId: true },
  });
  if (inquiry?.orderFormId) {
    const legacyIssue = await tx.tenantCoinLedgerEntry.findUnique({
      where: {
        tenantId_sourceType_sourceId: {
          tenantId,
          sourceType: 'ORDER_FORM_ISSUE',
          sourceId: inquiry.orderFormId,
        },
      },
      select: { id: true },
    });
    if (legacyIssue) return true;
  }

  return false;
}

export async function chargeQuickPasteCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; inquiryId: string },
): Promise<void> {
  await trySpendTenantCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    sourceType: 'QUICK_PASTE',
    sourceId: opts.inquiryId,
    amount: 2,
  });
}

/** 접수 1건당 코인 1회(발주 발급·예약금 대기·이후 상태 공통). 취소 시 환불 없음. */
export async function chargeInquiryCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; inquiryId: string },
): Promise<void> {
  if (await inquiryCoinAlreadyRecordedInTx(tx, opts.tenantId, opts.inquiryId)) {
    return;
  }

  await trySpendTenantCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    sourceType: 'INQUIRY',
    sourceId: opts.inquiryId,
  });
}

/** @deprecated chargeInquiryCoinInTx 사용 */
export async function chargeInquiryDepositPendingCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; inquiryId: string },
): Promise<void> {
  await chargeInquiryCoinInTx(tx, opts);
}

/** 과금 대상 상태 진입 시 접수 코인 차감 시도(이미 차감됐으면 스킵) */
export async function chargeInquiryStatusCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; inquiryId: string; status: InquiryStatus },
): Promise<void> {
  if (!isCoinChargeInquiryStatus(opts.status)) return;
  await chargeInquiryCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    inquiryId: opts.inquiryId,
  });
}

/** @deprecated chargeInquiryCoinInTx(inquiryId) 사용 */
export async function chargeOrderFormIssueCoinInTx(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; plan: string; orderFormId: string },
): Promise<void> {
  const inquiry = await tx.inquiry.findFirst({
    where: { tenantId: opts.tenantId, orderFormId: opts.orderFormId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!inquiry) return;
  await chargeInquiryCoinInTx(tx, {
    tenantId: opts.tenantId,
    plan: opts.plan,
    inquiryId: inquiry.id,
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
