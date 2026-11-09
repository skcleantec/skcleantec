import { prisma } from '../../lib/prisma.js';
import { kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import type { WalletUsageType } from '../../lib/walletPolicy.js';
import {
  ALIMTALK_MODULE_ID,
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_TEMPLATE_LABELS,
  alimtalkMonthlyFreeQuotaForPlan,
  alimtalkPlanAllowsFeature,
} from '../../lib/alimtalkPolicy.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import {
  getAlimtalkWalletView,
  ensureTenantAlimtalkDefaults,
  listRecentAlimtalkChargeLogs,
  applyPlatformAlimtalkTopUp,
  applyPlatformWalletClawback,
  validatePlatformWalletAdjustKrw,
  type PlatformWalletAdjustKind,
} from './alimtalkWallet.service.js';
import {
  approveAlimtalkChargeRequest,
  listPendingAlimtalkChargeRequestsForTenant,
  upsertTenantAlimtalkTemplateSettings,
  type AlimtalkChargeRequestDto,
} from './alimtalkChargeRequest.service.js';

export type AlimtalkChargeLogDto = {
  id: string;
  amountKrw: number;
  balanceAfterKrw: number;
  memo: string | null;
  createdAt: string;
  actorName: string | null;
  kind: 'paid' | 'grant' | 'clawback' | 'card' | 'other';
  reason: string | null;
  tenantLabel: string;
  taxInvoice: {
    status: 'PENDING' | 'ISSUED' | 'FAILED' | 'SKIPPED' | 'NONE';
    ntsConfirmNum: string | null;
    paymentId: string | null;
    walletInvoiceId: string | null;
    label: string;
  };
  cardReceipt: {
    paymentId: string | null;
    approvalNo: string | null;
  } | null;
};

export type AlimtalkSettingsForPlatform = {
  licensed: boolean;
  planAllows: boolean;
  plan: string;
  monthlyFreeEnabled: boolean;
  monthlyFreeUnlimited: boolean;
  monthlyFreeQuota: number;
  monthlyFreeUsed: number;
  monthlyFreeRemaining: number;
  prepaidBalanceKrw: number;
  templates: { code: string; label: string; enabled: boolean }[];
  recentChargeLogs: AlimtalkChargeLogDto[];
  pendingChargeRequests: AlimtalkChargeRequestDto[];
  monthUsage: { key: 'alimtalk' | 'cashbill' | 'taxinvoice'; label: string; amountKrw: number }[];
};

export async function getAlimtalkSettingsForPlatform(tenantId: string): Promise<AlimtalkSettingsForPlatform> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  const licensed = await isFeatureEnabled(tenantId, ALIMTALK_MODULE_ID);
  await ensureTenantAlimtalkDefaults(tenantId, tenant.plan);
  const walletRow = await prisma.tenantAlimtalkWallet.findUniqueOrThrow({ where: { tenantId } });
  const wallet =
    licensed && alimtalkPlanAllowsFeature(tenant.plan)
      ? await getAlimtalkWalletView(tenantId, tenant.plan)
      : null;

  const settings = await prisma.tenantAlimtalkTemplateSetting.findMany({ where: { tenantId } });
  const settingMap = new Map(settings.map((s) => [s.templateCode, s.isEnabled]));
  const recentChargeLogs = await listRecentAlimtalkChargeLogs(tenantId, 10);
  const pendingChargeRequests = await listPendingAlimtalkChargeRequestsForTenant(tenantId);
  const monthUsage = await walletMonthUsage(tenantId);
  const enrichedLogs = await enrichChargeLogsWithReceipts(tenantId, recentChargeLogs);

  return {
    licensed,
    planAllows: alimtalkPlanAllowsFeature(tenant.plan),
    plan: tenant.plan,
    monthlyFreeEnabled: walletRow.monthlyFreeEnabled,
    monthlyFreeUnlimited: wallet?.monthlyFreeUnlimited === true || walletRow.monthlyFreeUnlimited === true,
    monthlyFreeQuota: wallet?.monthlyFreeQuota ?? alimtalkMonthlyFreeQuotaForPlan(tenant.plan),
    monthlyFreeUsed: wallet?.monthlyFreeUsed ?? 0,
    monthlyFreeRemaining: wallet?.monthlyFreeRemaining ?? 0,
    prepaidBalanceKrw: wallet?.prepaidBalanceKrw ?? walletRow.prepaidBalanceKrw,
    templates: ALIMTALK_TEMPLATE_CODES.map((code) => ({
      code,
      label: ALIMTALK_TEMPLATE_LABELS[code],
      enabled: settingMap.get(code) !== false,
    })),
    recentChargeLogs: enrichedLogs,
    pendingChargeRequests,
    monthUsage,
  };
}

async function enrichChargeLogsWithReceipts(
  tenantId: string,
  logs: Awaited<ReturnType<typeof listRecentAlimtalkChargeLogs>>,
): Promise<AlimtalkChargeLogDto[]> {
  if (logs.length === 0) return [];

  const payments = await prisma.usageFeeCardPayment.findMany({
    where: {
      tenantId,
      goodsName: '청소비서 지갑',
      status: 'APPROVED',
    },
    orderBy: { paidAt: 'desc' },
    take: 40,
    select: {
      id: true,
      payMethod: true,
      supplyAmountKrw: true,
      paidAt: true,
      approvalNo: true,
      platformWalletInvoice: {
        select: {
          id: true,
          status: true,
          ntsSendKey: true,
          error: true,
        },
      },
    },
  });

  const usedPaymentIds = new Set<string>();

  return logs.map((log) => {
    const base = {
      id: log.id,
      amountKrw: log.amountKrw,
      balanceAfterKrw: log.balanceAfterKrw,
      memo: log.reason,
      createdAt: log.createdAt.toISOString(),
      actorName: log.actorName,
      kind: log.kind,
      reason: log.reason,
      tenantLabel: log.tenantLabel,
    };

    if (log.kind === 'grant' || log.kind === 'clawback' || log.kind === 'other') {
      return {
        ...base,
        taxInvoice: {
          status: 'NONE' as const,
          ntsConfirmNum: null,
          paymentId: null,
          walletInvoiceId: null,
          label: '해당 없음',
        },
        cardReceipt: null,
      };
    }

    const match = payments.find((p) => {
      if (usedPaymentIds.has(p.id)) return false;
      if (p.supplyAmountKrw !== log.amountKrw) return false;
      const delta = Math.abs(p.paidAt.getTime() - log.createdAt.getTime());
      if (delta > 5 * 60_000) return false;
      if (log.kind === 'card') return p.payMethod === 'KEYIN' || p.payMethod === 'PAY_WINDOW';
      if (log.kind === 'paid') return p.payMethod === 'BANK';
      return true;
    });

    if (match) usedPaymentIds.add(match.id);

    if (log.kind === 'card' || (match && (match.payMethod === 'KEYIN' || match.payMethod === 'PAY_WINDOW'))) {
      return {
        ...base,
        taxInvoice: {
          status: 'NONE' as const,
          ntsConfirmNum: null,
          paymentId: match?.id ?? null,
          walletInvoiceId: null,
          label: '해당 없음(카드)',
        },
        cardReceipt: match
          ? { paymentId: match.id, approvalNo: match.approvalNo }
          : null,
      };
    }

    const wi = match?.platformWalletInvoice;
    if (!wi) {
      return {
        ...base,
        taxInvoice: {
          status: log.kind === 'paid' ? ('PENDING' as const) : ('NONE' as const),
          ntsConfirmNum: null,
          paymentId: match?.id ?? null,
          walletInvoiceId: null,
          label: log.kind === 'paid' ? '발행 준비 중' : '해당 없음',
        },
        cardReceipt: null,
      };
    }

    const status = wi.status as 'PENDING' | 'ISSUED' | 'FAILED' | 'SKIPPED';
    const label =
      status === 'ISSUED'
        ? '발행됨'
        : status === 'PENDING'
          ? '발행 준비 중'
          : status === 'FAILED'
            ? '발행 실패'
            : '해당 없음';

    return {
      ...base,
      taxInvoice: {
        status,
        ntsConfirmNum: wi.ntsSendKey,
        paymentId: match?.id ?? null,
        walletInvoiceId: wi.id,
        label,
      },
      cardReceipt: null,
    };
  });
}

const WALLET_MONTH_BUCKETS: { key: 'alimtalk' | 'cashbill' | 'taxinvoice'; label: string; types: WalletUsageType[] }[] = [
  { key: 'alimtalk', label: '알림톡', types: ['ALIMTALK'] },
  { key: 'cashbill', label: '현금영수증', types: ['CASHBILL_ISSUE', 'CASHBILL_CANCEL', 'CASHBILL_REFUND'] },
  { key: 'taxinvoice', label: '세금계산서', types: ['TAXINVOICE_ISSUE', 'TAXINVOICE_REFUND'] },
];

async function walletMonthUsage(tenantId: string) {
  const range = kstMonthRangeYm(kstTodayYmd().slice(0, 7));
  if (!range) {
    return WALLET_MONTH_BUCKETS.map((bucket) => ({ key: bucket.key, label: bucket.label, amountKrw: 0 }));
  }
  const rows = await prisma.tenantWalletUsageLog.groupBy({
    by: ['type'],
    where: { tenantId, createdAt: { gte: range.gte, lte: range.lte } },
    _sum: { amountKrw: true },
  });
  const net = new Map(rows.map((row) => [row.type, row._sum.amountKrw ?? 0]));
  return WALLET_MONTH_BUCKETS.map((bucket) => {
    const signed = bucket.types.reduce((sum, type) => sum + (net.get(type) ?? 0), 0);
    return { key: bucket.key, label: bucket.label, amountKrw: signed < 0 ? -signed : 0 };
  });
}

export async function saveAlimtalkPolicyForPlatform(
  tenantId: string,
  input: {
    licensed?: boolean;
    monthlyFreeEnabled?: boolean;
    monthlyFreeUnlimited?: boolean;
    templates?: { code: string; enabled: boolean }[];
  },
): Promise<AlimtalkSettingsForPlatform> {
  if (typeof input.licensed === 'boolean') {
    await prisma.tenantFeature.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId: ALIMTALK_MODULE_ID } },
      create: {
        tenantId,
        moduleId: ALIMTALK_MODULE_ID,
        enabled: input.licensed,
      },
      update: {
        enabled: input.licensed,
      },
    });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  await ensureTenantAlimtalkDefaults(tenantId, tenant.plan);

  if (typeof input.monthlyFreeUnlimited === 'boolean' && input.monthlyFreeUnlimited && !alimtalkPlanAllowsFeature(tenant.plan)) {
    throw new Error('Starter/Free 플랜에서는 알림톡 무제한을 켤 수 없습니다.');
  }

  const walletPatch: { monthlyFreeEnabled?: boolean; monthlyFreeUnlimited?: boolean } = {};
  if (typeof input.monthlyFreeEnabled === 'boolean') {
    walletPatch.monthlyFreeEnabled = input.monthlyFreeEnabled;
  }
  if (typeof input.monthlyFreeUnlimited === 'boolean') {
    walletPatch.monthlyFreeUnlimited = input.monthlyFreeUnlimited;
  }
  if (Object.keys(walletPatch).length > 0) {
    await prisma.tenantAlimtalkWallet.update({
      where: { tenantId },
      data: walletPatch,
    });
  }

  if (Array.isArray(input.templates)) {
    await upsertTenantAlimtalkTemplateSettings(tenantId, input.templates);
  }

  return getAlimtalkSettingsForPlatform(tenantId);
}

export async function chargeAlimtalkWalletForPlatform(
  tenantId: string,
  input: { amountKrw: number; memo?: string | null; chargeRequestId?: string | null; kind?: string | null },
  actorPlatformUserId?: string | null,
): Promise<AlimtalkSettingsForPlatform> {
  if (input.chargeRequestId) {
    await approveAlimtalkChargeRequest({
      tenantId,
      chargeRequestId: input.chargeRequestId,
      actorPlatformUserId,
      memo: input.memo,
    });
    return getAlimtalkSettingsForPlatform(tenantId);
  }
  const kind: PlatformWalletAdjustKind = input.kind === 'grant' || input.kind === 'clawback' || input.kind === 'paid' ? input.kind : 'paid';
  const amountError = validatePlatformWalletAdjustKrw(input.amountKrw);
  if (amountError) throw new Error(amountError);
  const reason = input.memo?.trim() ?? '';
  if ((kind === 'grant' || kind === 'clawback') && !reason) throw new Error('사유를 입력해 주세요.');
  if (kind === 'clawback') {
    await applyPlatformWalletClawback({
      tenantId,
      amountKrw: input.amountKrw,
      reason,
      actorPlatformUserId,
    });
  } else {
    const topUp = await applyPlatformAlimtalkTopUp({
      tenantId,
      amountKrw: input.amountKrw,
      memo: `cbiseo:${kind}:${reason}`,
      actorPlatformUserId,
      revenue: kind === 'paid',
    });
    if (kind === 'paid' && topUp.bankPaymentId) {
      const { scheduleIssueForBankWalletPayment } = await import('../platform-receipts/platformWalletInvoice.service.js');
      void scheduleIssueForBankWalletPayment(topUp.bankPaymentId);
    }
  }
  return getAlimtalkSettingsForPlatform(tenantId);
}
