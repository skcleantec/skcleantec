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

/** UI·가입정보 — 코인 차감 규칙 요약 */
export const TENANT_COIN_CHARGE_RULES_SUMMARY =
  '발주서 발급 1코인 · 예약금 대기 이후 상태 전환마다 1코인 · 정보공유 구매 1코인';

/** Premium — 3번째 브랜드부터 월 추가 (원, VAT 별도). 1~2번째는 기본+플랜 포함 */
export const TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW = 200_000;

/** 모든 테넌트 공통 시드 기본 영업 브랜드 1개 */
export const TENANT_BASE_OPERATING_BRAND_SLOTS = 1;

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
    /** 기본 1개 제외 추가 1개 포함 → 활성 상한 총 2개 */
    operatingBrands: 1,
  },
};

export function usageLimitForPlan(plan: string, metric: TenantUsageMetricId): TenantUsageLimit {
  const p = normalizePlanId(plan);
  return TENANT_PLAN_USAGE_LIMITS[p][metric];
}

/** operatingBrands 값 = 기본 브랜드(1) 제외 플랜 추가 포함분. 0 = 기본만 */
export function totalOperatingBrandSlotsIncludedInPlan(plan: string): number {
  const additional = usageLimitForPlan(plan, 'operatingBrands');
  if (additional == null) return TENANT_BASE_OPERATING_BRAND_SLOTS;
  return TENANT_BASE_OPERATING_BRAND_SLOTS + additional;
}

/** 활성 영업 브랜드 상한 (플랜 포함 총 개수) */
export function maxOperatingCompaniesForPlan(plan: string): number | null {
  return totalOperatingBrandSlotsIncludedInPlan(plan);
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
