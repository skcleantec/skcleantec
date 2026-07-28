/**
 * 테넌트 가입·과금용 사용량 기준 (플랜별 포함량)
 * 코인은 매월 1일 KST 리셋·이월 없음.
 */
import type { TenantPlanId } from './tenantFeatureModules.js';
import { normalizePlanId } from './tenantPlanNormalize.js';

export type TenantUsageMetricId =
  | 'monthlyCoins'
  | 'teamLeaders'
  | 'customCalendars'
  | 'operatingBrands';

export type TenantUsageLimit = number | null;

export const TENANT_USAGE_METRIC_LABELS: Record<TenantUsageMetricId, string> = {
  monthlyCoins: '이용 코인',
  teamLeaders: '팀장 계정',
  customCalendars: '맞춤 캘린더',
  operatingBrands: '영업 브랜드',
};

/** Premium — 브랜드 1개 초과분 월 추가 (원, VAT 별도) */
export const TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW = 200_000;

export const TENANT_PLAN_USAGE_LIMITS: Record<
  TenantPlanId,
  Record<TenantUsageMetricId, TenantUsageLimit>
> = {
  free: {
    monthlyCoins: 70,
    teamLeaders: 0,
    customCalendars: 0,
    operatingBrands: 0,
  },
  standard: {
    monthlyCoins: 300,
    teamLeaders: 5,
    customCalendars: 2,
    operatingBrands: 0,
  },
  standard_plus: {
    monthlyCoins: 700,
    teamLeaders: 10,
    customCalendars: 5,
    operatingBrands: 0,
  },
  premium: {
    monthlyCoins: null,
    teamLeaders: null,
    customCalendars: null,
    operatingBrands: 1,
  },
};

export function usageLimitForPlan(plan: string, metric: TenantUsageMetricId): TenantUsageLimit {
  const p = normalizePlanId(plan);
  return TENANT_PLAN_USAGE_LIMITS[p][metric];
}

/** operatingBrands 한도 0 = 기본 1개(시드)만 허용 */
export function maxOperatingCompaniesForPlan(plan: string): number | null {
  const limit = usageLimitForPlan(plan, 'operatingBrands');
  if (limit == null) return null;
  if (limit === 0) return 1;
  return limit;
}

export function usagePercent(used: number, limit: TenantUsageLimit): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 1000) / 10);
}

export function isUsageOverLimit(used: number, limit: TenantUsageLimit): boolean {
  if (limit == null) return false;
  return used > limit;
}

export function planHasUnlimitedCoins(plan: string): boolean {
  return usageLimitForPlan(plan, 'monthlyCoins') == null;
}

export function monthlyCoinAllowance(plan: string): number | null {
  return usageLimitForPlan(plan, 'monthlyCoins');
}
