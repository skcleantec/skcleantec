import { prisma } from '../../lib/prisma.js';
import {
  TENANT_FEATURE_MODULES,
  TENANT_PLANS,
  TENANT_USAGE_METRIC_LABELS,
  usageLimitForPlan,
  TENANT_BILLING_NOTE,
  normalizePlanId,
  type TenantPlanId,
  type TenantUsageMetricId,
} from './tenantFeatureCatalog.js';
import { getTenantCoinSnapshot } from './tenantCoin.service.js';
import { PLATFORM_SUPPORT_USER_WHERE } from '../platform/tenantSupportAccess.constants.js';
import { getEffectiveEnabledModules } from './tenantFeatures.service.js';

export type TenantSubscriptionUsageRow = {
  id: TenantUsageMetricId;
  label: string;
  used: number;
  limit: number | null;
  unit: string;
};

export type TenantSubscriptionServiceRow = {
  moduleId: string;
  label: string;
  tier: string;
};

export type TenantSubscriptionDto = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    plan: string;
    planLabel: string;
    timezone: string;
    createdAt: string;
    suspendedAt: string | null;
  };
  /** 이용 현황·사용량 집계 기준 시각 (API 호출 시점) */
  usageSnapshotAt: string;
  /** 플랫폼에서 플랜·기능을 마지막으로 조정한 시각 — config.subscription.planUpdatedAt 또는 가입일 */
  serviceUpdatedAt: string;
  enabledServices: TenantSubscriptionServiceRow[];
  usage: TenantSubscriptionUsageRow[];
  billingNote: string;
  coins?: {
    periodYm: string;
    allowance: number | null;
    spent: number;
    remaining: number | null;
    unlimited: boolean;
  };
};

function resolvePlanLabel(plan: string): string {
  const normalized = normalizePlanId(plan);
  return TENANT_PLANS[normalized].label;
}

function readServiceUpdatedAt(config: unknown, createdAt: Date): string {
  const sub = (config as { subscription?: { planUpdatedAt?: string } } | null)?.subscription;
  const raw = sub?.planUpdatedAt?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return createdAt.toISOString();
}

export async function getTenantSubscriptionForAdmin(tenantId: string): Promise<TenantSubscriptionDto> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      plan: true,
      timezone: true,
      config: true,
      createdAt: true,
      suspendedAt: true,
    },
  });
  if (!tenant) throw new Error('업체를 찾을 수 없습니다.');

  const [enabledModuleIds, teamLeaders, customCalendars, operatingBrands, coinSnapshot] =
    await Promise.all([
      getEffectiveEnabledModules(tenantId),
      prisma.user.count({
        where: {
          tenantId,
          isActive: true,
          role: 'TEAM_LEADER',
          ...PLATFORM_SUPPORT_USER_WHERE,
        },
      }),
      prisma.userCustomCalendar.count({ where: { tenantId } }),
      prisma.operatingCompany.count({ where: { tenantId, isActive: true } }),
      getTenantCoinSnapshot(prisma, tenantId, tenant.plan),
    ]);

  const enabledServices: TenantSubscriptionServiceRow[] = enabledModuleIds
    .map((moduleId) => {
      const meta = TENANT_FEATURE_MODULES[moduleId as keyof typeof TENANT_FEATURE_MODULES];
      if (!meta) {
        return { moduleId, label: moduleId, tier: 'custom' };
      }
      return { moduleId, label: meta.label, tier: meta.tier };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));

  const usageCounts: Record<TenantUsageMetricId, number> = {
    monthlyCoins: coinSnapshot.spent,
    teamLeaders,
    customCalendars,
    operatingBrands,
  };

  const usage: TenantSubscriptionUsageRow[] = (
    Object.keys(TENANT_USAGE_METRIC_LABELS) as TenantUsageMetricId[]
  ).map((id) => ({
    id,
    label: TENANT_USAGE_METRIC_LABELS[id],
    used: usageCounts[id],
    limit: usageLimitForPlan(tenant.plan, id),
    unit:
      id === 'monthlyCoins'
        ? '코인'
        : id === 'teamLeaders'
          ? '명'
          : id === 'customCalendars'
            ? '개'
            : '개',
  }));

  const now = new Date();

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan,
      planLabel: resolvePlanLabel(tenant.plan),
      timezone: tenant.timezone,
      createdAt: tenant.createdAt.toISOString(),
      suspendedAt: tenant.suspendedAt?.toISOString() ?? null,
    },
    usageSnapshotAt: now.toISOString(),
    serviceUpdatedAt: readServiceUpdatedAt(tenant.config, tenant.createdAt),
    enabledServices,
    usage,
    billingNote: TENANT_BILLING_NOTE,
    coins: coinSnapshot,
  };
}
