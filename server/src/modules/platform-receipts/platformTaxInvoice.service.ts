import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { TAXINVOICE_COST_KRW } from '../../lib/barobill/policy.js';
import { readPlatformIssuer } from './platformIssuer.js';
import {
  registAndIssueTaxInvoice,
  cancelIssuedTaxInvoice,
  fetchTaxInvoiceStates,
  type TaxInvoiceLine,
} from '../taxinvoice/taxInvoice.barobill.js';

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

export async function listPlatformTaxInvoices(params: {
  limit?: number;
  offset?: number;
  buyerTenantId?: string;
}) {
  const take = Math.min(Math.max(params.limit ?? 30, 1), 100);
  const skip = Math.max(params.offset ?? 0, 0);
  const where = params.buyerTenantId ? { buyerTenantId: params.buyerTenantId } : {};
  const [rows, total] = await Promise.all([
    prisma.platformTaxInvoiceIssue.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.platformTaxInvoiceIssue.count({ where }),
  ]);
  return { total, items: rows };
}

export async function platformTaxInvoiceMonthStats(yearMonth: string) {
  const start = new Date(`${yearMonth}-01T00:00:00+09:00`);
  const nextMonth = new Date(start);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const where = { modifyCode: null, createdAt: { gte: start, lt: nextMonth } };
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
