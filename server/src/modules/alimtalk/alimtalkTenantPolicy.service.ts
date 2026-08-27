import { prisma } from '../../lib/prisma.js';
import {
  ALIMTALK_MODULE_ID,
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_TEMPLATE_LABELS,
  alimtalkMonthlyFreeQuotaForPlan,
  alimtalkPlanAllowsFeature,
} from '../../lib/alimtalkPolicy.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { getAlimtalkWalletView, ensureTenantAlimtalkDefaults, listRecentAlimtalkChargeLogs, applyPlatformAlimtalkTopUp } from './alimtalkWallet.service.js';
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
};

export type AlimtalkSettingsForPlatform = {
  licensed: boolean;
  planAllows: boolean;
  plan: string;
  monthlyFreeEnabled: boolean;
  monthlyFreeQuota: number;
  monthlyFreeUsed: number;
  monthlyFreeRemaining: number;
  prepaidBalanceKrw: number;
  templates: { code: string; label: string; enabled: boolean }[];
  recentChargeLogs: AlimtalkChargeLogDto[];
  pendingChargeRequests: AlimtalkChargeRequestDto[];
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

  return {
    licensed,
    planAllows: alimtalkPlanAllowsFeature(tenant.plan),
    plan: tenant.plan,
    monthlyFreeEnabled: walletRow.monthlyFreeEnabled,
    monthlyFreeQuota: wallet?.monthlyFreeQuota ?? alimtalkMonthlyFreeQuotaForPlan(tenant.plan),
    monthlyFreeUsed: wallet?.monthlyFreeUsed ?? 0,
    monthlyFreeRemaining: wallet?.monthlyFreeRemaining ?? 0,
    prepaidBalanceKrw: wallet?.prepaidBalanceKrw ?? walletRow.prepaidBalanceKrw,
    templates: ALIMTALK_TEMPLATE_CODES.map((code) => ({
      code,
      label: ALIMTALK_TEMPLATE_LABELS[code],
      enabled: settingMap.get(code) !== false,
    })),
    recentChargeLogs: recentChargeLogs.map((log) => ({
      id: log.id,
      amountKrw: log.amountKrw,
      balanceAfterKrw: log.balanceAfterKrw,
      memo: log.memo,
      createdAt: log.createdAt.toISOString(),
    })),
    pendingChargeRequests,
  };
}

export async function saveAlimtalkPolicyForPlatform(
  tenantId: string,
  input: {
    licensed?: boolean;
    monthlyFreeEnabled?: boolean;
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

  if (typeof input.monthlyFreeEnabled === 'boolean') {
    await prisma.tenantAlimtalkWallet.update({
      where: { tenantId },
      data: { monthlyFreeEnabled: input.monthlyFreeEnabled },
    });
  }

  if (Array.isArray(input.templates)) {
    await upsertTenantAlimtalkTemplateSettings(tenantId, input.templates);
  }

  return getAlimtalkSettingsForPlatform(tenantId);
}

export async function chargeAlimtalkWalletForPlatform(
  tenantId: string,
  input: { amountKrw: number; memo?: string | null; chargeRequestId?: string | null },
  actorPlatformUserId?: string | null,
): Promise<AlimtalkSettingsForPlatform> {
  if (input.chargeRequestId) {
    await approveAlimtalkChargeRequest({
      tenantId,
      chargeRequestId: input.chargeRequestId,
      actorPlatformUserId,
      memo: input.memo,
    });
  } else {
    await applyPlatformAlimtalkTopUp({
      tenantId,
      amountKrw: input.amountKrw,
      memo: input.memo,
      actorPlatformUserId,
    });
  }
  return getAlimtalkSettingsForPlatform(tenantId);
}
