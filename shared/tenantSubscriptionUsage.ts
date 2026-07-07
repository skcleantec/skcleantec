/**
 * 테넌트 가입·과금용 사용량 기준 (플랜별 포함량)
 * 초과 과금은 추후 billing 연동 시 동일 키 사용.
 */

import type { TenantPlanId } from './tenantFeatureModules.js';

export type TenantUsageMetricId = 'activeUsers' | 'inquiriesThisMonth' | 'operatingBrands';

export type TenantUsageLimit = number | null;

export const TENANT_USAGE_METRIC_LABELS: Record<TenantUsageMetricId, string> = {
  activeUsers: '활성 업무 계정',
  inquiriesThisMonth: '이번 달 접수',
  operatingBrands: '영업 브랜드',
};

export const TENANT_PLAN_USAGE_LIMITS: Record<
  TenantPlanId,
  Record<TenantUsageMetricId, TenantUsageLimit>
> = {
  starter: {
    activeUsers: 8,
    inquiriesThisMonth: 400,
    operatingBrands: 1,
  },
  standard: {
    activeUsers: 25,
    inquiriesThisMonth: 1_500,
    operatingBrands: 3,
  },
  premium: {
    activeUsers: null,
    inquiriesThisMonth: null,
    operatingBrands: null,
  },
};

export function usageLimitForPlan(plan: string, metric: TenantUsageMetricId): TenantUsageLimit {
  const p = plan in TENANT_PLAN_USAGE_LIMITS ? (plan as TenantPlanId) : 'standard';
  return TENANT_PLAN_USAGE_LIMITS[p][metric];
}

export function usagePercent(used: number, limit: TenantUsageLimit): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 1000) / 10);
}

export function isUsageOverLimit(used: number, limit: TenantUsageLimit): boolean {
  if (limit == null) return false;
  return used > limit;
}
