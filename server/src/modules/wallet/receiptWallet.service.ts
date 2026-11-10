import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { WALLET_LOW_BALANCE_KRW } from '../../lib/walletPolicy.js';
import { kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { ensurePlatformBillingSettings } from '../billing/tenantBilling.service.js';
import { isPaymentTestAmountEnabled } from '../../lib/paymentTestAmount.js';
import { ensureTenantAlimtalkDefaults, walletChargePresentation } from '../alimtalk/alimtalkWallet.service.js';
import { getWalletInvoiceViewUrl } from '../platform-receipts/platformWalletInvoice.service.js';
import {
  awaitingChargeRequestReceipt,
  enrichChargesWithReceipts,
  type ChargeTaxInvoiceInfo,
  type ChargeCardReceiptInfo,
} from './walletChargeReceiptEnrich.service.js';

const LEDGER_FILTERS = ['all', 'charge', 'cashbill', 'taxinvoice', 'alimtalk'] as const;
export type WalletLedgerFilter = (typeof LEDGER_FILTERS)[number];

export type TenantChargeTaxInvoice = ChargeTaxInvoiceInfo;
export type TenantChargeCardReceipt = ChargeCardReceiptInfo;

export async function getReceiptWalletSummary(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { plan: true, name: true } });
  if (!tenant) return null;
  await ensureTenantAlimtalkDefaults(tenantId, tenant.plan);
  const monthKey = kstTodayYmd().slice(0, 7);
  const range = kstMonthRangeYm(monthKey);
  const [wallet, pendingRow, grouped, billing, latestChargeRow] = await Promise.all([
    prisma.tenantAlimtalkWallet.findUnique({ where: { tenantId }, select: { prepaidBalanceKrw: true } }),
    prisma.alimtalkChargeRequest.findFirst({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { amountKrw: true, createdAt: true },
    }),
    range
      ? prisma.tenantWalletUsageLog.groupBy({
          by: ['type'],
          where: { tenantId, createdAt: range },
          _count: { _all: true },
          _sum: { amountKrw: true },
        })
      : Promise.resolve([]),
    ensurePlatformBillingSettings(),
    prisma.alimtalkWalletChargeLog.findFirst({
      where: { tenantId, amountKrw: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, amountKrw: true, createdAt: true, memo: true },
    }),
  ]);
  const balanceKrw = wallet?.prepaidBalanceKrw ?? 0;
  const spent = (prefix: string, kinds: string[]) => {
    const rows = grouped.filter((row) => kinds.includes(row.type));
    const count = rows.filter((row) => row.type.startsWith(prefix) && !row.type.endsWith('_REFUND')).reduce((sum, row) => sum + row._count._all, 0);
    const amountKrw = rows.reduce((sum, row) => sum + Math.abs(Math.min(0, row._sum.amountKrw ?? 0)), 0);
    return { count, amountKrw };
  };
  const cashbill = spent('CASHBILL_', ['CASHBILL_ISSUE', 'CASHBILL_CANCEL', 'CASHBILL_REFUND']);
  const taxInvoice = spent('TAXINVOICE_', ['TAXINVOICE_ISSUE', 'TAXINVOICE_REFUND']);
  const alimtalkRows = grouped.filter((row) => row.type === 'ALIMTALK');
  let alimtalkKrw = alimtalkRows.reduce((sum, row) => sum + Math.abs(Math.min(0, row._sum.amountKrw ?? 0)), 0);
  if (range) {
    const refs = await prisma.tenantWalletUsageLog.findMany({
      where: { tenantId, type: 'ALIMTALK', refId: { not: null }, createdAt: range },
      select: { refId: true },
    });
    const ids = refs.map((row) => row.refId).filter((id): id is string => Boolean(id));
    const extra = await prisma.alimtalkSendLog.aggregate({
      where: {
        tenantId,
        createdAt: range,
        tenantUnitPriceKrw: { gt: 0 },
        ...(ids.length > 0 ? { id: { notIn: ids } } : {}),
      },
      _sum: { tenantUnitPriceKrw: true },
    });
    alimtalkKrw += extra._sum.tenantUnitPriceKrw ?? 0;
  }

  let latestCharge: {
    id: string;
    amountKrw: number;
    createdAt: string;
    taxInvoice: TenantChargeTaxInvoice;
  } | null = null;
  if (latestChargeRow) {
    const shown = walletChargePresentation(latestChargeRow.memo);
    const [receipt] = await enrichChargesWithReceipts(
      tenantId,
      [
        {
          id: latestChargeRow.id,
          amountKrw: latestChargeRow.amountKrw,
          createdAt: latestChargeRow.createdAt,
          kind: shown.kind,
        },
      ],
      { tenantFacing: true },
    );
    latestCharge = {
      id: latestChargeRow.id,
      amountKrw: latestChargeRow.amountKrw,
      createdAt: latestChargeRow.createdAt.toISOString(),
      taxInvoice: receipt?.taxInvoice ?? {
        status: 'NONE',
        ntsConfirmNum: null,
        paymentId: null,
        walletInvoiceId: null,
        label: '해당 없음',
        canView: false,
      },
    };
  }

  return {
    balanceKrw,
    lowBalance: balanceKrw < WALLET_LOW_BALANCE_KRW,
    pendingChargeKrw: pendingRow?.amountKrw ?? 0,
    pendingCharge: pendingRow
      ? { amountKrw: pendingRow.amountKrw, createdAt: pendingRow.createdAt.toISOString() }
      : null,
    latestCharge,
    tenantName: tenant.name,
    testAmountEnabled: isPaymentTestAmountEnabled(),
    month: {
      cashbillCount: cashbill.count,
      cashbillKrw: cashbill.amountKrw,
      taxInvoiceCount: taxInvoice.count,
      taxInvoiceKrw: taxInvoice.amountKrw,
      alimtalkKrw,
    },
    bank: {
      bankName: billing.bankName,
      accountNumber: billing.accountNumber,
      accountHolder: billing.accountHolder,
      paymentGuideText: billing.paymentGuideText,
    },
  };
}

function ledgerWhere(filter: WalletLedgerFilter): Prisma.Sql {
  if (filter === 'charge') return Prisma.sql`kind = 'CHARGE'`;
  if (filter === 'cashbill') return Prisma.sql`kind = 'USAGE' AND type LIKE 'CASHBILL_%'`;
  if (filter === 'taxinvoice') return Prisma.sql`kind = 'USAGE' AND type LIKE 'TAXINVOICE_%'`;
  if (filter === 'alimtalk') return Prisma.sql`kind = 'USAGE' AND type = 'ALIMTALK'`;
  return Prisma.sql`TRUE`;
}

type LedgerRow = {
  id: string;
  kind: string;
  type: string | null;
  amount_krw: number;
  balance_after_krw: number;
  created_at: Date;
  memo: string | null;
};

export function parseWalletLedgerFilter(raw: unknown): WalletLedgerFilter {
  const text = typeof raw === 'string' ? raw : 'all';
  return (LEDGER_FILTERS as readonly string[]).includes(text) ? (text as WalletLedgerFilter) : 'all';
}

export async function listReceiptWalletLedger(tenantId: string, filter: WalletLedgerFilter, limit: number, offset: number) {
  const where = ledgerWhere(filter);
  const rows = await prisma.$queryRaw<LedgerRow[]>`
    SELECT id, kind, type, amount_krw, balance_after_krw, created_at, memo
    FROM (
      SELECT id, 'CHARGE' AS kind, NULL::text AS type, amount_krw, balance_after_krw, created_at, memo
      FROM alimtalk_wallet_charge_logs
      WHERE tenant_id = ${tenantId}
      UNION ALL
      SELECT id, 'USAGE' AS kind, type, amount_krw, balance_after_krw, created_at, NULL::text AS memo
      FROM tenant_wallet_usage_logs
      WHERE tenant_id = ${tenantId}
    ) entries
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const totalRows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM (
      SELECT id, 'CHARGE' AS kind, NULL::text AS type
      FROM alimtalk_wallet_charge_logs
      WHERE tenant_id = ${tenantId}
      UNION ALL
      SELECT id, 'USAGE' AS kind, type
      FROM tenant_wallet_usage_logs
      WHERE tenant_id = ${tenantId}
    ) entries
    WHERE ${where}
  `;
  const trendDesc = await prisma.$queryRaw<Array<{ created_at: Date; balance_after_krw: number }>>`
    SELECT created_at, balance_after_krw
    FROM (
      SELECT created_at, balance_after_krw, 'CHARGE' AS kind, NULL::text AS type
      FROM alimtalk_wallet_charge_logs
      WHERE tenant_id = ${tenantId}
      UNION ALL
      SELECT created_at, balance_after_krw, 'USAGE' AS kind, type
      FROM tenant_wallet_usage_logs
      WHERE tenant_id = ${tenantId}
    ) entries
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT 30
  `;

  const chargeInputs = rows
    .filter((row) => row.kind === 'CHARGE')
    .map((row) => {
      const shown = walletChargePresentation(row.memo);
      return {
        id: row.id,
        amountKrw: row.amount_krw,
        createdAt: row.created_at,
        kind: shown.kind,
      };
    });
  const chargeReceipts = await enrichChargesWithReceipts(tenantId, chargeInputs, { tenantFacing: true });
  const receiptById = new Map(chargeInputs.map((input, i) => [input.id, chargeReceipts[i]!]));

  const pendingRequests =
    filter === 'all' || filter === 'charge'
      ? await prisma.alimtalkChargeRequest.findMany({
          where: { tenantId, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, amountKrw: true, memo: true, createdAt: true, status: true },
        })
      : [];

  const awaiting = awaitingChargeRequestReceipt();

  return {
    items: rows.map((row) => {
      const shown = row.kind === 'CHARGE' ? walletChargePresentation(row.memo) : null;
      const receipt = row.kind === 'CHARGE' ? receiptById.get(row.id) : null;
      return {
        id: row.id,
        kind: row.kind === 'CHARGE' ? ('CHARGE' as const) : ('USAGE' as const),
        type: row.type,
        amountKrw: row.amount_krw,
        balanceAfterKrw: row.balance_after_krw,
        createdAt: row.created_at.toISOString(),
        memo: shown && shown.kind !== 'other' ? shown.reason : row.memo,
        tenantLabel: shown?.tenantLabel ?? null,
        chargeKind: shown?.kind ?? null,
        taxInvoice: receipt?.taxInvoice ?? null,
        cardReceipt: receipt?.cardReceipt ?? null,
      };
    }),
    pendingChargeRequests: pendingRequests.map((req) => ({
      id: req.id,
      amountKrw: req.amountKrw,
      memo: req.memo,
      createdAt: req.createdAt.toISOString(),
      status: req.status,
      taxInvoice: awaiting.taxInvoice,
    })),
    total: Number(totalRows[0]?.n ?? 0),
    trend: trendDesc.reverse().map((row) => ({
      at: row.created_at.toISOString(),
      balanceAfterKrw: row.balance_after_krw,
    })),
  };
}

export async function getTenantWalletTaxInvoiceViewUrl(
  tenantId: string,
  input: { walletInvoiceId?: string; paymentId?: string },
): Promise<string> {
  return getWalletInvoiceViewUrl({
    walletInvoiceId: input.walletInvoiceId,
    paymentId: input.paymentId,
    tenantId,
  });
}
