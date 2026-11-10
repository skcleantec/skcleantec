import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { CASHBILL_COST_KRW } from '../../lib/barobill/policy.js';
import { readPlatformIssuer } from './platformIssuer.js';
import {
  registAndIssueCashBill,
  cancelCashBillFull,
  fetchCashbillState,
  fetchCashbillMailUrl,
  fetchCashbillPrintUrl,
} from '../cashbill/cashbillIssue.barobill.js';
import {
  tradeDateRangeFilter,
  type PlatformReceiptStatusFilter,
} from './platformReceiptsQuery.js';

export type PlatformCashBillInput = {
  tradeUsage: '1' | '2';
  tradeMethod?: '4' | '5';
  identityNum: string;
  identityMaskedOverride?: string;
  customerName?: string;
  itemName: string;
  taxKind: 'TAXATION' | 'EXEMPTION' | 'FREE';
  amount: number;
  tax: number;
  serviceCharge?: number;
  tradeDate: string;
  email?: string;
  buyerTenantId?: string;
  buyerCorpNum?: string;
  internalMemo?: string;
  createdByPlatformUserId?: string;
};

function taxKindLabel(kind: string): string {
  if (kind === 'EXEMPTION') return '면세';
  if (kind === 'FREE') return '비과세';
  return '과세';
}

function maskIdentity(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-*****`;
  if (digits.length >= 8) return `${digits.slice(0, 6)}-*******`;
  return `${raw.slice(0, 3)}***`;
}

function yyyymmdd(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function issuePlatformCashBill(input: PlatformCashBillInput) {
  const issuer = readPlatformIssuer();
  const mgtKey = `pcb${randomBytes(10).toString('hex')}`;
  const totalWon = input.amount + input.tax + (input.serviceCharge ?? 0);

  await registAndIssueCashBill({
    corpNum: issuer.corpNum,
    userId: issuer.barobillUserId,
    mgtKey,
    identityNum: input.identityNum,
    corpName: issuer.corpName,
    ceoName: issuer.ceoName,
    addr: issuer.addr,
    tel: issuer.tel,
    tradeDate: input.tradeDate,
    tradeUsage: input.tradeUsage,
    tradeMethod: input.tradeMethod ?? '4',
    amount: String(input.amount),
    tax: String(input.tax),
    serviceCharge: String(input.serviceCharge ?? 0),
    itemName: input.itemName,
    email: input.email,
  });

  const state = await fetchCashbillState({
    corpNum: issuer.corpNum,
    userId: issuer.barobillUserId,
    mgtKey,
  }).catch(() => null);

  const record = await prisma.platformCashBillIssue.create({
    data: {
      mgtKey,
      tradeUsage: input.tradeUsage,
      identityMasked: input.identityMaskedOverride ?? maskIdentity(input.identityNum),
      customerName: input.customerName ?? null,
      itemName: input.itemName,
      taxKind: taxKindLabel(input.taxKind),
      amount: input.amount,
      tax: input.tax,
      serviceCharge: input.serviceCharge ?? 0,
      totalWon,
      tradeDate: input.tradeDate,
      barobillState: state?.barobillState ?? '2000',
      ntsConfirmNum: state?.ntsConfirmNum ?? null,
      issuedAt: new Date(),
      costKrw: CASHBILL_COST_KRW,
      buyerTenantId: input.buyerTenantId ?? null,
      buyerCorpNum: input.buyerCorpNum ?? null,
      internalMemo: input.internalMemo ?? null,
      createdByPlatformUserId: input.createdByPlatformUserId ?? null,
      kind: 'FULL',
    },
  });
  return record;
}

export async function cancelPlatformCashBill(id: string) {
  const original = await prisma.platformCashBillIssue.findFirst({ where: { id } });
  if (!original) throw new Error('현금영수증을 찾을 수 없습니다.');
  if (original.kind !== 'FULL') throw new Error('이미 취소된 현금영수증입니다.');

  const issuer = readPlatformIssuer();
  const cancelMgtKey = `pcb-c${randomBytes(10).toString('hex')}`;

  await cancelCashBillFull({
    corpNum: issuer.corpNum,
    userId: issuer.barobillUserId,
    mgtKey: original.mgtKey,
    cancelMgtKey,
  });

  const cancel = await prisma.platformCashBillIssue.create({
    data: {
      mgtKey: cancelMgtKey,
      tradeUsage: original.tradeUsage,
      identityMasked: original.identityMasked,
      customerName: original.customerName,
      itemName: original.itemName,
      taxKind: original.taxKind,
      amount: -original.amount,
      tax: -original.tax,
      serviceCharge: -original.serviceCharge,
      totalWon: -original.totalWon,
      tradeDate: yyyymmdd(new Date()),
      issuedAt: new Date(),
      costKrw: 0,
      buyerTenantId: original.buyerTenantId,
      buyerCorpNum: original.buyerCorpNum,
      cancelOfId: original.id,
      kind: 'CANCEL',
      createdByPlatformUserId: original.createdByPlatformUserId,
    },
  });

  await prisma.platformCashBillIssue.updateMany({
    where: { id: original.id },
    data: { kind: 'CANCELLED' },
  });

  return cancel;
}

async function resolveTenantIdsByName(q: string): Promise<string[]> {
  if (!q) return [];
  const tenants = await prisma.tenant.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: { id: true },
    take: 200,
  });
  return tenants.map((t) => t.id);
}

export async function buildPlatformCashBillWhere(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: PlatformReceiptStatusFilter;
  q?: string;
  buyerTenantId?: string;
}): Promise<Prisma.PlatformCashBillIssueWhereInput> {
  const where: Prisma.PlatformCashBillIssueWhereInput = {
    kind: { not: 'CANCEL' },
  };
  if (params.buyerTenantId) where.buyerTenantId = params.buyerTenantId;
  const range = tradeDateRangeFilter(params.fromYmd ?? '', params.toYmd ?? '');
  if (range) where.tradeDate = range;

  if (params.status === 'ISSUED') {
    where.kind = 'FULL';
    where.lastError = null;
  } else if (params.status === 'CANCELLED') {
    where.kind = 'CANCELLED';
  } else if (params.status === 'FAILED') {
    where.NOT = { lastError: null };
  }

  const q = (params.q ?? '').trim();
  if (q) {
    const tenantIds = await resolveTenantIdsByName(q);
    const nameOr: Prisma.PlatformCashBillIssueWhereInput[] = [
      { customerName: { contains: q, mode: 'insensitive' } },
      { identityMasked: { contains: q, mode: 'insensitive' } },
      { buyerCorpNum: { contains: q.replace(/\D/g, '') } },
      ...(tenantIds.length ? [{ buyerTenantId: { in: tenantIds } }] : []),
    ];
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: nameOr },
    ];
  }
  return where;
}

export async function listPlatformCashBills(params: {
  limit?: number;
  offset?: number;
  buyerTenantId?: string;
  fromYmd?: string;
  toYmd?: string;
  status?: PlatformReceiptStatusFilter;
  q?: string;
}) {
  const take = Math.min(Math.max(params.limit ?? 30, 1), 100);
  const skip = Math.max(params.offset ?? 0, 0);
  const where = await buildPlatformCashBillWhere(params);
  const [rows, total] = await Promise.all([
    prisma.platformCashBillIssue.findMany({ where, orderBy: [{ tradeDate: 'desc' }, { createdAt: 'desc' }], take, skip }),
    prisma.platformCashBillIssue.count({ where }),
  ]);
  return { total, items: rows };
}

export async function platformCashBillStats(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: PlatformReceiptStatusFilter;
  q?: string;
  buyerTenantId?: string;
}) {
  const where = await buildPlatformCashBillWhere(params);
  const [count, agg] = await Promise.all([
    prisma.platformCashBillIssue.count({ where }),
    prisma.platformCashBillIssue.aggregate({
      where,
      _sum: { costKrw: true, totalWon: true, amount: true, tax: true },
    }),
  ]);
  return {
    count,
    costKrw: agg._sum.costKrw ?? 0,
    totalWon: agg._sum.totalWon ?? 0,
    supplyWon: agg._sum.amount ?? 0,
    taxWon: agg._sum.tax ?? 0,
  };
}

/** @deprecated use platformCashBillStats */
export async function platformCashBillMonthStats(yearMonth: string) {
  const start = `${yearMonth.replace(/\D/g, '').slice(0, 6)}01`;
  const y = Number(yearMonth.slice(0, 4));
  const m = Number(yearMonth.slice(5, 7));
  const next = m === 12 ? `${y + 1}0101` : `${y}${String(m + 1).padStart(2, '0')}01`;
  const endNum = Number(next) - 1;
  return platformCashBillStats({ fromYmd: start, toYmd: String(endNum) });
}

export async function listPlatformCashBillsForExport(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: PlatformReceiptStatusFilter;
  q?: string;
}) {
  const where = await buildPlatformCashBillWhere(params);
  return prisma.platformCashBillIssue.findMany({
    where,
    orderBy: [{ tradeDate: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
  });
}

export async function syncPlatformCashBillState(id: string) {
  const record = await prisma.platformCashBillIssue.findFirst({ where: { id } });
  if (!record) throw new Error('현금영수증을 찾을 수 없습니다.');
  const issuer = readPlatformIssuer();
  const state = await fetchCashbillState({ corpNum: issuer.corpNum, userId: issuer.barobillUserId, mgtKey: record.mgtKey });
  if (!state) return record;
  return prisma.platformCashBillIssue.update({
    where: { id },
    data: { barobillState: state.barobillState, ntsConfirmNum: state.ntsConfirmNum ?? null },
  });
}

export async function getPlatformCashBillViewUrl(id: string, tenantId?: string | null): Promise<string> {
  const record = await prisma.platformCashBillIssue.findFirst({ where: { id } });
  if (!record) throw new Error('현금영수증을 찾을 수 없습니다.');
  if (tenantId && record.buyerTenantId && record.buyerTenantId !== tenantId) {
    throw new Error('이 업체의 영수증이 아닙니다.');
  }
  if (record.lastError || record.cancelOfId || record.kind === 'CANCELLED' || record.kind === 'CANCEL') {
    throw new Error('발행된 현금영수증만 볼 수 있습니다.');
  }
  const issuer = readPlatformIssuer();
  return fetchCashbillMailUrl({
    corpNum: issuer.corpNum,
    userId: issuer.barobillUserId,
    mgtKey: record.mgtKey,
  });
}

export async function getPlatformCashBillPrintUrl(id: string): Promise<string> {
  const record = await prisma.platformCashBillIssue.findFirst({ where: { id } });
  if (!record) throw new Error('현금영수증을 찾을 수 없습니다.');
  if (record.lastError || record.cancelOfId || record.kind === 'CANCELLED' || record.kind === 'CANCEL') {
    throw new Error('발행된 현금영수증만 인쇄할 수 있습니다.');
  }
  const issuer = readPlatformIssuer();
  return fetchCashbillPrintUrl({
    corpNum: issuer.corpNum,
    userId: issuer.barobillUserId,
    mgtKey: record.mgtKey,
  });
}
