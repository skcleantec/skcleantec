import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { TAXINVOICE_COST_KRW } from '../../lib/barobill/policy.js';
import { readPlatformIssuer } from './platformIssuer.js';
import {
  registAndIssueTaxInvoice,
  cancelIssuedTaxInvoice,
  fetchTaxInvoiceStates,
  fetchTaxInvoiceMailUrl,
  type TaxInvoiceLine,
} from '../taxinvoice/taxInvoice.barobill.js';
import {
  tradeDateRangeFilter,
  type PlatformReceiptStatusFilter,
} from './platformReceiptsQuery.js';

export type PlatformTaxInvoiceInput = {
  purposeType: 1 | 2;
  writeDate: string;
  buyerCorpNum: string;
  buyerCorpName: string;
  buyerCeoName?: string;
  buyerAddr?: string;
  buyerEmail?: string;
  buyerContactName?: string;
  buyerBizType?: string;
  buyerBizClass?: string;
  supply: number;
  tax: number;
  lines: TaxInvoiceLine[];
  internalMemo?: string;
  buyerTenantId?: string;
  modifyCode?: string;
  originalIssueId?: string;
  createdByPlatformUserId?: string;
};

export async function issuePlatformTaxInvoice(input: PlatformTaxInvoiceInput) {
  const issuer = readPlatformIssuer();
  const mgtKey = `pti${randomBytes(10).toString('hex')}`;
  const total = input.supply + input.tax;

  await registAndIssueTaxInvoice({
    corpNum: issuer.corpNum,
    userId: issuer.barobillUserId,
    mgtKey,
    corpName: issuer.corpName,
    ceoName: issuer.ceoName,
    addr: issuer.addr,
    bizType: issuer.bizType,
    bizClass: issuer.bizClass,
    email: issuer.email,
    tel: issuer.tel,
    contactName: issuer.contactName,
    buyerCorpNum: input.buyerCorpNum,
    buyerCorpName: input.buyerCorpName,
    buyerCeoName: input.buyerCeoName ?? '',
    buyerAddr: input.buyerAddr ?? '',
    buyerEmail: input.buyerEmail ?? '',
    buyerContactName: input.buyerContactName ?? '',
    buyerBizType: input.buyerBizType ?? '',
    buyerBizClass: input.buyerBizClass ?? '',
    writeDate: input.writeDate,
    purposeType: input.purposeType,
    taxType: 1,
    taxInvoiceType: 1,
    supply: input.supply,
    tax: input.tax,
    total,
    lines: input.lines,
    modifyCode: input.modifyCode ?? '',
  });

  const [state] = await fetchTaxInvoiceStates({ corpNum: issuer.corpNum, mgtKeys: [mgtKey] }).catch(() => []);

  const record = await prisma.platformTaxInvoiceIssue.create({
    data: {
      mgtKey,
      purposeType: input.purposeType,
      writeDate: input.writeDate,
      buyerCorpNum: input.buyerCorpNum,
      buyerCorpName: input.buyerCorpName,
      buyerCeoName: input.buyerCeoName ?? '',
      buyerAddr: input.buyerAddr ?? '',
      buyerEmail: input.buyerEmail ?? '',
      buyerContactName: input.buyerContactName ?? '',
      supplyKrw: input.supply,
      taxKrw: input.tax,
      totalKrw: total,
      lines: input.lines as object[],
      barobillState: state?.barobillState ?? '3014',
      ntsSendState: state?.ntsSendState ?? '1',
      ntsSendKey: state?.ntsSendKey ?? null,
      costKrw: TAXINVOICE_COST_KRW,
      internalMemo: input.internalMemo ?? null,
      buyerTenantId: input.buyerTenantId ?? null,
      modifyCode: input.modifyCode ?? null,
      originalIssueId: input.originalIssueId ?? null,
      createdByPlatformUserId: input.createdByPlatformUserId ?? null,
    },
  });
  return record;
}

export async function cancelPlatformTaxInvoice(id: string) {
  const record = await prisma.platformTaxInvoiceIssue.findFirst({ where: { id } });
  if (!record) throw new Error('세금계산서를 찾을 수 없습니다.');
  if (record.modifyCode) throw new Error('수정 세금계산서는 취소할 수 없습니다.');

  const issuer = readPlatformIssuer();
  await cancelIssuedTaxInvoice({ corpNum: issuer.corpNum, mgtKey: record.mgtKey });

  return prisma.platformTaxInvoiceIssue.update({
    where: { id },
    data: { barobillState: 'ISSUE_CANCEL' },
  });
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

export async function buildPlatformTaxInvoiceWhere(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: PlatformReceiptStatusFilter;
  q?: string;
  buyerTenantId?: string;
}): Promise<Prisma.PlatformTaxInvoiceIssueWhereInput> {
  const where: Prisma.PlatformTaxInvoiceIssueWhereInput = {
    modifyCode: null,
  };
  if (params.buyerTenantId) where.buyerTenantId = params.buyerTenantId;
  const range = tradeDateRangeFilter(params.fromYmd ?? '', params.toYmd ?? '');
  if (range) where.writeDate = range;

  if (params.status === 'ISSUED') {
    where.lastError = null;
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ barobillState: null }, { NOT: { barobillState: { in: ['ISSUE_CANCEL', '5031'] } } }] },
    ];
  } else if (params.status === 'CANCELLED') {
    where.barobillState = { in: ['ISSUE_CANCEL', '5031'] };
  } else if (params.status === 'FAILED') {
    where.NOT = { lastError: null };
  }

  const q = (params.q ?? '').trim();
  if (q) {
    const tenantIds = await resolveTenantIdsByName(q);
    const nameOr: Prisma.PlatformTaxInvoiceIssueWhereInput[] = [
      { buyerCorpName: { contains: q, mode: 'insensitive' } },
      { buyerCeoName: { contains: q, mode: 'insensitive' } },
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

export async function listPlatformTaxInvoices(params: {
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
  const where = await buildPlatformTaxInvoiceWhere(params);
  const [rows, total] = await Promise.all([
    prisma.platformTaxInvoiceIssue.findMany({ where, orderBy: [{ writeDate: 'desc' }, { createdAt: 'desc' }], take, skip }),
    prisma.platformTaxInvoiceIssue.count({ where }),
  ]);
  return { total, items: rows };
}

export async function platformTaxInvoiceStats(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: PlatformReceiptStatusFilter;
  q?: string;
  buyerTenantId?: string;
}) {
  const where = await buildPlatformTaxInvoiceWhere(params);
  const [count, agg] = await Promise.all([
    prisma.platformTaxInvoiceIssue.count({ where }),
    prisma.platformTaxInvoiceIssue.aggregate({
      where,
      _sum: { costKrw: true, totalKrw: true, supplyKrw: true, taxKrw: true },
    }),
  ]);
  return {
    count,
    costKrw: agg._sum.costKrw ?? 0,
    totalWon: agg._sum.totalKrw ?? 0,
    supplyWon: agg._sum.supplyKrw ?? 0,
    taxWon: agg._sum.taxKrw ?? 0,
  };
}

/** @deprecated use platformTaxInvoiceStats */
export async function platformTaxInvoiceMonthStats(yearMonth: string) {
  const start = `${yearMonth.replace(/\D/g, '').slice(0, 6)}01`;
  const y = Number(yearMonth.slice(0, 4));
  const m = Number(yearMonth.slice(5, 7));
  const next = m === 12 ? `${y + 1}0101` : `${y}${String(m + 1).padStart(2, '0')}01`;
  const endNum = Number(next) - 1;
  return platformTaxInvoiceStats({ fromYmd: start, toYmd: String(endNum) });
}

export async function listPlatformTaxInvoicesForExport(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: PlatformReceiptStatusFilter;
  q?: string;
}) {
  const where = await buildPlatformTaxInvoiceWhere(params);
  return prisma.platformTaxInvoiceIssue.findMany({
    where,
    orderBy: [{ writeDate: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
  });
}

export async function syncPlatformTaxInvoiceStates(ids: string[]) {
  const records = await prisma.platformTaxInvoiceIssue.findMany({ where: { id: { in: ids } } });
  if (records.length === 0) return [];
  const issuer = readPlatformIssuer();
  const states = await fetchTaxInvoiceStates({ corpNum: issuer.corpNum, mgtKeys: records.map((r) => r.mgtKey) });
  type TiState = (typeof states)[number];
  const stateMap = new Map<string, TiState>(states.map((s) => [s.mgtKey, s]));
  const updated = await Promise.all(
    records.map(async (r) => {
      const s: TiState | undefined = stateMap.get(r.mgtKey);
      if (!s) return r;
      return prisma.platformTaxInvoiceIssue.update({
        where: { id: r.id },
        data: {
          barobillState: s.barobillState,
          ntsSendState: s.ntsSendState,
          ntsSendKey: s.ntsSendKey ?? null,
        },
      });
    }),
  );
  return updated;
}

export async function getPlatformTaxInvoiceViewUrl(id: string, tenantId?: string | null): Promise<string> {
  const record = await prisma.platformTaxInvoiceIssue.findFirst({ where: { id } });
  if (!record) throw new Error('세금계산서를 찾을 수 없습니다.');
  if (tenantId && record.buyerTenantId && record.buyerTenantId !== tenantId) {
    throw new Error('이 업체의 영수증이 아닙니다.');
  }
  if (record.lastError || record.barobillState === 'ISSUE_CANCEL' || record.barobillState === '5031') {
    throw new Error('발행된 세금계산서만 볼 수 있습니다.');
  }
  const issuer = readPlatformIssuer();
  return fetchTaxInvoiceMailUrl({ corpNum: issuer.corpNum, mgtKey: record.mgtKey });
}
