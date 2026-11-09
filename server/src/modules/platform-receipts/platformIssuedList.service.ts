import { prisma } from '../../lib/prisma.js';
import { tradeDateRangeFilter } from './platformReceiptsQuery.js';

export type IssuedReceiptKindFilter = '' | 'cashbill' | 'taxinvoice';
export type IssuedReceiptStatusFilter = '' | 'ISSUED' | 'CANCELLED' | 'FAILED';

export type IssuedReceiptRow = {
  id: string;
  source: 'cashbill' | 'taxinvoice' | 'wallet_taxinvoice';
  kind: 'cashbill' | 'taxinvoice';
  purpose: 'wallet' | 'direct';
  purposeLabel: string;
  kindLabel: string;
  issuedAt: string;
  partyName: string;
  tenantId: string | null;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  totalAmountKrw: number;
  status: 'ISSUED' | 'CANCELLED' | 'FAILED';
  ntsConfirmNum: string | null;
  paymentId: string | null;
  error: string | null;
  canCancel: boolean;
  canView: boolean;
};

function ymdToDateStart(ymd: string): Date | null {
  if (ymd.length !== 8) return null;
  return new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00+09:00`);
}

function ymdToDateEnd(ymd: string): Date | null {
  if (ymd.length !== 8) return null;
  return new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T23:59:59.999+09:00`);
}

function cashbillStatus(row: {
  lastError: string | null;
  kind: string;
  cancelOfId: string | null;
}): IssuedReceiptRow['status'] {
  if (row.lastError) return 'FAILED';
  if (row.kind === 'CANCELLED' || row.kind === 'CANCEL' || Boolean(row.cancelOfId)) return 'CANCELLED';
  return 'ISSUED';
}

function taxStatus(row: {
  lastError: string | null;
  barobillState: string | null;
}): IssuedReceiptRow['status'] {
  if (row.lastError) return 'FAILED';
  if (row.barobillState === 'ISSUE_CANCEL' || row.barobillState === '5031') return 'CANCELLED';
  return 'ISSUED';
}

function walletStatus(row: {
  status: string;
  cancelledAt: Date | null;
}): IssuedReceiptRow['status'] {
  if (row.cancelledAt) return 'CANCELLED';
  if (row.status === 'FAILED') return 'FAILED';
  if (row.status === 'ISSUED') return 'ISSUED';
  return 'FAILED';
}

async function tenantNameMap(ids: (string | null | undefined)[]) {
  const tenantIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (tenantIds.length === 0) return new Map<string, string>();
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  return new Map(tenants.map((t) => [t.id, t.name]));
}

export async function listIssuedReceipts(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: IssuedReceiptStatusFilter;
  kind?: IssuedReceiptKindFilter;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: IssuedReceiptRow[]; total: number; stats: {
  count: number;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  totalAmountKrw: number;
  costKrw: number;
} }> {
  const take = Math.min(Math.max(params.limit ?? 30, 1), 100);
  const skip = Math.max(params.offset ?? 0, 0);
  const fromYmd = params.fromYmd ?? '';
  const toYmd = params.toYmd ?? '';
  const status = params.status ?? '';
  const kind = params.kind ?? '';
  const q = (params.q ?? '').trim();
  const tradeRange = tradeDateRangeFilter(fromYmd, toYmd);
  const fromDate = ymdToDateStart(fromYmd);
  const toDate = ymdToDateEnd(toYmd);

  const wantCash = kind === '' || kind === 'cashbill';
  const wantTax = kind === '' || kind === 'taxinvoice';

  const [cashRows, taxRows, walletRows] = await Promise.all([
    wantCash
      ? prisma.platformCashBillIssue.findMany({
          where: {
            ...(tradeRange ? { tradeDate: tradeRange } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        })
      : Promise.resolve([]),
    wantTax
      ? prisma.platformTaxInvoiceIssue.findMany({
          where: {
            ...(tradeRange ? { writeDate: tradeRange } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        })
      : Promise.resolve([]),
    wantTax
      ? prisma.platformWalletInvoice.findMany({
          where: {
            status: { in: ['ISSUED', 'FAILED'] },
            ...(fromDate || toDate
              ? {
                  OR: [
                    {
                      issuedAt: {
                        ...(fromDate ? { gte: fromDate } : {}),
                        ...(toDate ? { lte: toDate } : {}),
                      },
                    },
                    {
                      issuedAt: null,
                      createdAt: {
                        ...(fromDate ? { gte: fromDate } : {}),
                        ...(toDate ? { lte: toDate } : {}),
                      },
                    },
                  ],
                }
              : {}),
          },
          include: {
            payment: {
              select: {
                supplyAmountKrw: true,
                vatAmountKrw: true,
                amountKrw: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        })
      : Promise.resolve([]),
  ]);

  const names = await tenantNameMap([
    ...cashRows.map((r) => r.buyerTenantId),
    ...taxRows.map((r) => r.buyerTenantId),
    ...walletRows.map((r) => r.tenantId),
  ]);

  const merged: IssuedReceiptRow[] = [];

  for (const row of cashRows) {
    const st = cashbillStatus(row);
    const party =
      names.get(row.buyerTenantId ?? '') ||
      row.customerName?.trim() ||
      row.identityMasked ||
      '고객';
    merged.push({
      id: row.id,
      source: 'cashbill',
      kind: 'cashbill',
      purpose: 'direct',
      purposeLabel: '직접 발행',
      kindLabel: '현금영수증',
      issuedAt: (row.issuedAt ?? row.createdAt).toISOString(),
      partyName: party,
      tenantId: row.buyerTenantId,
      supplyAmountKrw: row.amount,
      vatAmountKrw: row.tax,
      totalAmountKrw: row.totalWon,
      status: st,
      ntsConfirmNum: row.ntsConfirmNum,
      paymentId: null,
      error: row.lastError,
      canCancel: st === 'ISSUED',
      canView: st === 'ISSUED' && Boolean(row.mgtKey),
    });
  }

  for (const row of taxRows) {
    const st = taxStatus(row);
    const lines = Array.isArray(row.lines) ? row.lines : [];
    const first = lines[0] as { name?: string } | undefined;
    const isWalletLine = first?.name === '청소비서 지갑 충전';
    merged.push({
      id: row.id,
      source: 'taxinvoice',
      kind: 'taxinvoice',
      purpose: isWalletLine ? 'wallet' : 'direct',
      purposeLabel: isWalletLine ? '지갑 충전' : '직접 발행',
      kindLabel: '세금계산서',
      issuedAt: row.createdAt.toISOString(),
      partyName: names.get(row.buyerTenantId ?? '') || row.buyerCorpName || '업체',
      tenantId: row.buyerTenantId,
      supplyAmountKrw: row.supplyKrw,
      vatAmountKrw: row.taxKrw,
      totalAmountKrw: row.totalKrw,
      status: st,
      ntsConfirmNum: row.ntsSendKey,
      paymentId: null,
      error: row.lastError,
      canCancel: st === 'ISSUED',
      canView: st === 'ISSUED' && Boolean(row.mgtKey),
    });
  }

  for (const row of walletRows) {
    const st = walletStatus(row);
    merged.push({
      id: row.id,
      source: 'wallet_taxinvoice',
      kind: 'taxinvoice',
      purpose: 'wallet',
      purposeLabel: '지갑 충전',
      kindLabel: '세금계산서',
      issuedAt: (row.issuedAt ?? row.createdAt).toISOString(),
      partyName: names.get(row.tenantId) || '업체',
      tenantId: row.tenantId,
      supplyAmountKrw: row.payment?.supplyAmountKrw ?? 0,
      vatAmountKrw: row.payment?.vatAmountKrw ?? 0,
      totalAmountKrw: row.payment?.amountKrw ?? 0,
      status: st,
      ntsConfirmNum: row.ntsSendKey,
      paymentId: row.paymentId,
      error: row.error,
      canCancel: st === 'ISSUED',
      canView: st === 'ISSUED' && Boolean(row.mgtKey),
    });
  }

  let filtered = merged;
  if (status) filtered = filtered.filter((r) => r.status === status);
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((r) => r.partyName.toLowerCase().includes(needle));
  }
  filtered.sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : a.issuedAt > b.issuedAt ? -1 : 0));

  const stats = {
    count: filtered.length,
    supplyAmountKrw: filtered.reduce((s, r) => s + r.supplyAmountKrw, 0),
    vatAmountKrw: filtered.reduce((s, r) => s + r.vatAmountKrw, 0),
    totalAmountKrw: filtered.reduce((s, r) => s + r.totalAmountKrw, 0),
    costKrw: 0,
  };

  return {
    items: filtered.slice(skip, skip + take),
    total: filtered.length,
    stats,
  };
}

export async function listIssuedReceiptsForExport(params: {
  fromYmd?: string;
  toYmd?: string;
  status?: IssuedReceiptStatusFilter;
  kind?: IssuedReceiptKindFilter;
  q?: string;
}) {
  const result = await listIssuedReceipts({ ...params, limit: 5000, offset: 0 });
  return result.items;
}
