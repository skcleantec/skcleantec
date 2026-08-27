import { prisma } from '../../lib/prisma.js';
import {
  ALIMTALK_MODULE_ID,
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_TEMPLATE_LABELS,
  ALIMTALK_UNIT_PRICE_ATA_KRW,
  ALIMTALK_UNIT_PRICE_LMS_KRW,
  alimtalkMonthlyFreeQuotaForPlan,
  alimtalkPlanAllowsFeature,
} from '../../lib/alimtalkPolicy.js';
import {
  parseScheduleD2DaysBeforePenaltyInput,
  SCHEDULE_D2_SEND_HOUR_KST,
} from '../../lib/alimtalkScheduleD2Timing.js';
import { ensurePlatformBillingSettings } from '../billing/tenantBilling.service.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import {
  createAlimtalkChargeRequest,
  getPendingAlimtalkChargeRequestForTenant,
  listAlimtalkChargeRequestsForTenant,
  listPendingAlimtalkChargeRequestsForTenant,
  upsertTenantAlimtalkTemplateSettings,
  type AlimtalkChargeRequestDto,
} from './alimtalkChargeRequest.service.js';
import {
  ensureTenantAlimtalkDefaults,
  getAlimtalkWalletView,
  listRecentAlimtalkChargeLogs,
  type AlimtalkWalletChargeLogView,
} from './alimtalkWallet.service.js';

export type AlimtalkBankGuideDto = {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  paymentGuideText: string | null;
};

export type AlimtalkSettingsForTenantAdmin = {
  licensed: boolean;
  planAllows: boolean;
  plan: string;
  monthlyFreeEnabled: boolean;
  monthlyFreeQuota: number;
  monthlyFreeUsed: number;
  monthlyFreeRemaining: number;
  prepaidBalanceKrw: number;
  unitPriceAtaKrw: number;
  unitPriceLmsKrw: number;
  canSend: boolean;
  bank: AlimtalkBankGuideDto;
  templates: { code: string; label: string; enabled: boolean }[];
  scheduleD2DaysBeforePenalty: number | null;
  scheduleD2SendHourKst: number;
  pendingChargeRequest: AlimtalkChargeRequestDto | null;
  recentChargeRequests: AlimtalkChargeRequestDto[];
  recentChargeLogs: {
    id: string;
    amountKrw: number;
    balanceAfterKrw: number;
    memo: string | null;
    createdAt: string;
  }[];
};

function mapChargeLogs(logs: AlimtalkWalletChargeLogView[]) {
  return logs.map((log) => ({
    id: log.id,
    amountKrw: log.amountKrw,
    balanceAfterKrw: log.balanceAfterKrw,
    memo: log.memo,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function getAlimtalkSettingsForTenantAdmin(
  tenantId: string,
): Promise<AlimtalkSettingsForTenantAdmin> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  const [licensed, billingSettings] = await Promise.all([
    isFeatureEnabled(tenantId, ALIMTALK_MODULE_ID),
    ensurePlatformBillingSettings(),
  ]);

  await ensureTenantAlimtalkDefaults(tenantId, tenant.plan);
  const walletRow = await prisma.tenantAlimtalkWallet.findUniqueOrThrow({ where: { tenantId } });
  const wallet =
    licensed && alimtalkPlanAllowsFeature(tenant.plan)
      ? await getAlimtalkWalletView(tenantId, tenant.plan)
      : null;

  const settings = await prisma.tenantAlimtalkTemplateSetting.findMany({ where: { tenantId } });
  const settingMap = new Map(settings.map((s) => [s.templateCode, s.isEnabled]));
  const scheduleD2Row = settings.find((s) => s.templateCode === 'CBISEO_CUST_SCHEDULE_D2');

  const [recentChargeLogs, pendingChargeRequest, recentChargeRequests] = await Promise.all([
    listRecentAlimtalkChargeLogs(tenantId, 10),
    getPendingAlimtalkChargeRequestForTenant(tenantId),
    listAlimtalkChargeRequestsForTenant(tenantId, 10),
  ]);

  const monthlyFreeRemaining = wallet?.monthlyFreeRemaining ?? 0;
  const prepaidBalanceKrw = wallet?.prepaidBalanceKrw ?? walletRow.prepaidBalanceKrw;
  const canSend =
    licensed &&
    alimtalkPlanAllowsFeature(tenant.plan) &&
    (monthlyFreeRemaining >= 3 || prepaidBalanceKrw >= ALIMTALK_UNIT_PRICE_LMS_KRW);

  return {
    licensed,
    planAllows: alimtalkPlanAllowsFeature(tenant.plan),
    plan: tenant.plan,
    monthlyFreeEnabled: walletRow.monthlyFreeEnabled,
    monthlyFreeQuota: wallet?.monthlyFreeQuota ?? alimtalkMonthlyFreeQuotaForPlan(tenant.plan),
    monthlyFreeUsed: wallet?.monthlyFreeUsed ?? 0,
    monthlyFreeRemaining,
    prepaidBalanceKrw,
    unitPriceAtaKrw: ALIMTALK_UNIT_PRICE_ATA_KRW,
    unitPriceLmsKrw: ALIMTALK_UNIT_PRICE_LMS_KRW,
    canSend,
    bank: {
      bankName: billingSettings.bankName,
      accountNumber: billingSettings.accountNumber,
      accountHolder: billingSettings.accountHolder,
      paymentGuideText: billingSettings.paymentGuideText,
    },
    templates: ALIMTALK_TEMPLATE_CODES.map((code) => ({
      code,
      label: ALIMTALK_TEMPLATE_LABELS[code],
      enabled: settingMap.get(code) !== false,
    })),
    scheduleD2DaysBeforePenalty: scheduleD2Row?.scheduleD2DaysBeforePenalty ?? null,
    scheduleD2SendHourKst: SCHEDULE_D2_SEND_HOUR_KST,
    pendingChargeRequest,
    recentChargeRequests,
    recentChargeLogs: mapChargeLogs(recentChargeLogs),
  };
}

export async function saveAlimtalkTemplatesForTenantAdmin(
  tenantId: string,
  input: {
    templates?: { code: string; enabled: boolean }[];
    scheduleD2DaysBeforePenalty?: number | null;
  },
): Promise<AlimtalkSettingsForTenantAdmin> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  const licensed = await isFeatureEnabled(tenantId, ALIMTALK_MODULE_ID);
  if (!licensed || !alimtalkPlanAllowsFeature(tenant.plan)) {
    throw new Error('알림톡을 사용할 수 없는 플랜이거나 라이선스가 꺼져 있습니다.');
  }

  await ensureTenantAlimtalkDefaults(tenantId, tenant.plan);

  if (input.templates) {
    await upsertTenantAlimtalkTemplateSettings(tenantId, input.templates);
  }

  if (input.scheduleD2DaysBeforePenalty !== undefined) {
    const parsed = parseScheduleD2DaysBeforePenaltyInput(input.scheduleD2DaysBeforePenalty);
    if ('error' in parsed) {
      throw new Error(parsed.error);
    }
    await prisma.tenantAlimtalkTemplateSetting.upsert({
      where: {
        tenantId_templateCode: { tenantId, templateCode: 'CBISEO_CUST_SCHEDULE_D2' },
      },
      create: {
        tenantId,
        templateCode: 'CBISEO_CUST_SCHEDULE_D2',
        isEnabled: true,
        scheduleD2DaysBeforePenalty: parsed.value,
      },
      update: {
        scheduleD2DaysBeforePenalty: parsed.value,
      },
    });
  }

  return getAlimtalkSettingsForTenantAdmin(tenantId);
}

export async function requestAlimtalkTopUpForTenantAdmin(
  tenantId: string,
  requestedByUserId: string,
  input: { amountKrw: number; memo?: string | null },
): Promise<AlimtalkSettingsForTenantAdmin> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new Error('Tenant not found');

  const licensed = await isFeatureEnabled(tenantId, ALIMTALK_MODULE_ID);
  if (!licensed || !alimtalkPlanAllowsFeature(tenant.plan)) {
    throw new Error('알림톡을 사용할 수 없는 플랜이거나 라이선스가 꺼져 있습니다.');
  }

  await createAlimtalkChargeRequest({
    tenantId,
    requestedByUserId,
    amountKrw: input.amountKrw,
    memo: input.memo,
  });
  return getAlimtalkSettingsForTenantAdmin(tenantId);
}

export { listPendingAlimtalkChargeRequestsForTenant };
