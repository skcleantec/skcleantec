import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';
import { getPlatformCardFeeRates } from './cardPayment.settings.service.js';

export type PgFeeLedgerQuery = {
  datePreset?: string;
  month?: string;
  day?: string;
  tenantId?: string;
  limit: number;
  offset: number;
};

type Bucket = {
  tenantId: string;
  onboardingId: string | null;
  name: string;
  feeBps: number | null;
  deleted: boolean;
  amountWon: number;
  merchantFeeWon: number;
  serviceBridgeWon: number;
  marginWon: number;
  approvedCount: number;
  cancelCount: number;
};

function signed(status: string, value: number): number {
  return status === 'CANCELLED' ? -value : value;
}

export function feePercentToBps(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n)) return null;
  const bps = Math.round(n * 100);
  if (bps < 0 || bps > 10_000) return null;
  return bps;
}

export async function listPgFeeLedger(query: PgFeeLedgerQuery) {
  const rates = await getPlatformCardFeeRates();
  const range = createdAtRangeFromQuery({
    datePreset: query.datePreset,
    month: query.month,
    day: query.day,
  });
  const tenantId = query.tenantId?.trim() || undefined;
  const paymentWhere: Prisma.CardPaymentWhereInput = {
    status: { in: ['APPROVED', 'CANCELLED'] },
    ...(tenantId ? { tenantId } : {}),
    ...(range
      ? {
          OR: [
            { paidAt: { gte: range.gte, lte: range.lte } },
            { paidAt: null, createdAt: { gte: range.gte, lte: range.lte } },
          ],
        }
      : {}),
  };

  const [groups, onboardings] = await Promise.all([
    prisma.cardPayment.groupBy({
      by: ['tenantId', 'status'],
      where: paymentWhere,
      _sum: { amountWon: true, tenantFeeWon: true, platformCostWon: true, platformSpreadWon: true },
      _count: { _all: true },
    }),
    prisma.tenantPgOnboarding.findMany({
      where: tenantId ? { tenantId } : { status: { not: 'DRAFT' } },
      select: {
        id: true,
        tenantId: true,
        businessName: true,
        feeBps: true,
        merchantDeletedAt: true,
        tenant: { select: { name: true } },
      },
    }),
  ]);

  const buckets = new Map<string, Bucket>();
  for (const row of onboardings) {
    buckets.set(row.tenantId, {
      tenantId: row.tenantId,
      onboardingId: row.id,
      name: row.businessName?.trim() || row.tenant.name,
      feeBps: row.feeBps,
      deleted: Boolean(row.merchantDeletedAt),
      amountWon: 0,
      merchantFeeWon: 0,
      serviceBridgeWon: 0,
      marginWon: 0,
      approvedCount: 0,
      cancelCount: 0,
    });
  }

  const missing: string[] = [];
  for (const group of groups) {
    let bucket = buckets.get(group.tenantId);
    if (!bucket) {
      missing.push(group.tenantId);
      bucket = {
        tenantId: group.tenantId,
        onboardingId: null,
        name: '가맹점',
        feeBps: null,
        deleted: false,
        amountWon: 0,
        merchantFeeWon: 0,
        serviceBridgeWon: 0,
        marginWon: 0,
        approvedCount: 0,
        cancelCount: 0,
      };
      buckets.set(group.tenantId, bucket);
    }
    const count = group._count._all;
    bucket.amountWon += signed(group.status, group._sum.amountWon ?? 0);
    bucket.merchantFeeWon += signed(group.status, group._sum.tenantFeeWon ?? 0);
    bucket.serviceBridgeWon += signed(group.status, group._sum.platformCostWon ?? 0);
    bucket.marginWon += signed(group.status, group._sum.platformSpreadWon ?? 0);
    if (group.status === 'CANCELLED') bucket.cancelCount += count;
    else bucket.approvedCount += count;
  }

  if (missing.length > 0) {
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: missing } },
      select: { id: true, name: true },
    });
    for (const tenant of tenants) {
      const bucket = buckets.get(tenant.id);
      if (bucket && bucket.name === '가맹점') bucket.name = tenant.name;
    }
  }

  const rows = [...buckets.values()].sort((a, b) => {
    if (a.deleted !== b.deleted) return a.deleted ? 1 : -1;
    if (b.marginWon !== a.marginWon) return b.marginWon - a.marginWon;
    return a.name.localeCompare(b.name, 'ko');
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.amountWon += row.amountWon;
      acc.merchantFeeWon += row.merchantFeeWon;
      acc.serviceBridgeWon += row.serviceBridgeWon;
      acc.marginWon += row.marginWon;
      acc.approvedCount += row.approvedCount;
      acc.cancelCount += row.cancelCount;
      return acc;
    },
    { amountWon: 0, merchantFeeWon: 0, serviceBridgeWon: 0, marginWon: 0, approvedCount: 0, cancelCount: 0 },
  );

  const total = rows.length;
  const items = rows.slice(query.offset, query.offset + query.limit).map((row) => ({
    ...row,
    feeBps: row.feeBps ?? rates.tenantFeeBps,
    feeIsCustom: row.feeBps != null,
  }));

  return {
    serviceBridgeBps: rates.platformCostBps,
    defaultMerchantBps: rates.tenantFeeBps,
    summary,
    total,
    items,
    merchants: rows.map((row) => ({ tenantId: row.tenantId, name: row.name, deleted: row.deleted })),
  };
}

export async function setMerchantFeeBps(tenantId: string, feeBps: number) {
  const row = await prisma.tenantPgOnboarding.findUnique({
    where: { tenantId },
    select: { id: true, merchantDeletedAt: true },
  });
  if (!row) return { error: '가맹점을 찾을 수 없습니다.' as const };
  if (row.merchantDeletedAt) return { error: '삭제된 가맹점의 수수료는 바꿀 수 없습니다.' as const };
  await prisma.tenantPgOnboarding.update({ where: { tenantId }, data: { feeBps } });
  return { ok: true as const, feeBps };
}

/** 가맹 연결만 끊는다. 업체와 결제 내역은 남긴다. */
export async function deletePgMerchant(tenantId: string) {
  const row = await prisma.tenantPgOnboarding.findUnique({
    where: { tenantId },
    select: { id: true, merchantDeletedAt: true },
  });
  if (!row) return { error: '가맹점을 찾을 수 없습니다.' as const };
  if (row.merchantDeletedAt) return { error: '이미 삭제된 가맹점입니다.' as const };
  await prisma.$transaction(async (tx) => {
    await tx.tenantPgCredential.deleteMany({ where: { tenantId } });
    await tx.tenantPgOnboarding.update({
      where: { tenantId },
      data: { merchantDeletedAt: new Date() },
    });
  });
  return { ok: true as const };
}
