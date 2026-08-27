/**
 * 테넌트 기능 모듈 카탈로그 — shared/tenantFeatureModules.ts 와 동기화.
 * @see docs/MULTI_TENANT_PLATFORM.md
 */

export const TENANT_FEATURE_MODULES = {
  core_inquiries: { label: '서비스접수·발주서', tier: 'core' as const, defaultOn: true },
  core_schedule: { label: '스케줄', tier: 'core' as const, defaultOn: true },
  core_assignments: { label: '배정', tier: 'core' as const, defaultOn: true },
  core_messages: { label: '메시지', tier: 'standard' as const, defaultOn: true },
  mod_cs: { label: 'C/S 관리', tier: 'standard' as const, defaultOn: true },
  mod_advertising: { label: '광고비', tier: 'standard' as const, defaultOn: false },
  mod_payroll: { label: '급여·정산', tier: 'premium' as const, defaultOn: false },
  mod_e_contract: { label: '전자계약', tier: 'premium' as const, defaultOn: false },
  mod_external_co: { label: '타업체·외부정산', tier: 'standard' as const, defaultOn: true },
  mod_tenant_exchange: { label: '파트너 접수 연계', tier: 'premium' as const, defaultOn: false },
  mod_db_marketplace: { label: '정보공유(DB 마켓)', tier: 'standard' as const, defaultOn: false },
  mod_crew: { label: '크루(현장)', tier: 'standard' as const, defaultOn: true },
  mod_team_stats: { label: '팀장 통계', tier: 'standard' as const, defaultOn: true },
  mod_inspection: { label: '현장 검수', tier: 'standard' as const, defaultOn: true },
  mod_telecrm: { label: '텔레CRM', tier: 'premium' as const, defaultOn: false },
  mod_landing_inquiry: { label: '랜딩 문의내역', tier: 'premium' as const, defaultOn: false },
  mod_quick_paste: { label: '빠른등록', tier: 'standard' as const, defaultOn: true },
  mod_alimtalk: { label: '알림톡', tier: 'standard' as const, defaultOn: true },
} as const;

export type TenantFeatureModuleId = keyof typeof TENANT_FEATURE_MODULES;

/** Premium·Standard+ 공통 업무 모듈 (텔레CRM mod_telecrm 은 별도 옵션 — 미포함) */
export const TENANT_PREMIUM_BUSINESS_MODULE_IDS = [
  'core_inquiries',
  'core_schedule',
  'core_assignments',
  'core_messages',
  'mod_cs',
  'mod_external_co',
  'mod_tenant_exchange',
  'mod_db_marketplace',
  'mod_crew',
  'mod_team_stats',
  'mod_inspection',
  'mod_advertising',
  'mod_payroll',
  'mod_e_contract',
  'mod_landing_inquiry',
  'mod_quick_paste',
  'mod_alimtalk',
] as const satisfies readonly TenantFeatureModuleId[];

export const TENANT_PLANS = {
  free: {
    label: 'Free',
    modules: ['core_inquiries', 'core_schedule', 'mod_db_marketplace', 'mod_quick_paste'] as TenantFeatureModuleId[],
  },
  standard: {
    label: 'Standard',
    modules: [
      'core_inquiries',
      'core_schedule',
      'core_assignments',
      'core_messages',
      'mod_cs',
      'mod_external_co',
      'mod_crew',
      'mod_team_stats',
      'mod_inspection',
      'mod_advertising',
      'mod_db_marketplace',
      'mod_quick_paste',
      'mod_alimtalk',
    ] as TenantFeatureModuleId[],
  },
  standard_plus: {
    label: 'Standard+',
    modules: [...TENANT_PREMIUM_BUSINESS_MODULE_IDS],
  },
  premium: {
    label: 'Premium',
    modules: [...TENANT_PREMIUM_BUSINESS_MODULE_IDS],
  },
} as const;

export type TenantPlanId = keyof typeof TENANT_PLANS;

const KNOWN_PLANS = new Set<string>(['free', 'standard', 'standard_plus', 'premium']);

export function normalizePlanId(plan: string | null | undefined): TenantPlanId {
  const raw = String(plan ?? '').trim().toLowerCase();
  if (raw === 'starter') return 'standard';
  if (KNOWN_PLANS.has(raw)) return raw as TenantPlanId;
  return 'standard';
}

export const TENANT_PLAN_ID_SET: Record<string, 1> = {
  free: 1,
  standard: 1,
  standard_plus: 1,
  premium: 1,
  starter: 1,
};

/** 코어 모듈은 오버라이드로 끌 수 없음 (free는 core_assignments 미포함) */
export const CORE_FEATURE_MODULE_IDS = new Set<TenantFeatureModuleId>([
  'core_inquiries',
  'core_schedule',
]);

export function modulesForPlan(plan: string): TenantFeatureModuleId[] {
  const p = normalizePlanId(plan);
  return [...TENANT_PLANS[p].modules];
}

/** @see shared/tenantSubscriptionUsage.ts — 동기화 */
export type TenantUsageMetricId = 'monthlyCoins' | 'teamLeaders' | 'customCalendars' | 'operatingBrands';

export const TENANT_USAGE_METRIC_LABELS: Record<TenantUsageMetricId, string> = {
  monthlyCoins: '이용 코인',
  teamLeaders: '팀장 계정',
  customCalendars: '맞춤 캘린더',
  operatingBrands: '영업 브랜드',
};

export const TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW = 200_000;

export const TENANT_PLAN_USAGE_LIMITS: Record<
  TenantPlanId,
  Record<TenantUsageMetricId, number | null>
> = {
  free: { monthlyCoins: 70, teamLeaders: 0, customCalendars: 0, operatingBrands: 0 },
  standard: { monthlyCoins: 300, teamLeaders: 5, customCalendars: 2, operatingBrands: 0 },
  standard_plus: { monthlyCoins: 700, teamLeaders: 10, customCalendars: 5, operatingBrands: 0 },
  premium: { monthlyCoins: null, teamLeaders: null, customCalendars: null, operatingBrands: 1 },
};

export function usageLimitForPlan(plan: string, metric: TenantUsageMetricId): number | null {
  const p = normalizePlanId(plan);
  return TENANT_PLAN_USAGE_LIMITS[p][metric];
}

export function totalOperatingBrandSlotsIncludedInPlan(plan: string): number {
  const additional = usageLimitForPlan(plan, 'operatingBrands');
  if (additional == null) return 1;
  return 1 + additional;
}

export function maxOperatingCompaniesForPlan(plan: string): number | null {
  return totalOperatingBrandSlotsIncludedInPlan(plan);
}

export function planHasUnlimitedCoins(plan: string): boolean {
  return usageLimitForPlan(plan, 'monthlyCoins') == null;
}

export function monthlyCoinAllowance(plan: string): number | null {
  return usageLimitForPlan(plan, 'monthlyCoins');
}

/** @see shared/tenantPlanCatalog.ts — 동기화 */
export const TENANT_BILLING_NOTE =
  '월 정액 플랜(Free·Standard 10만·Standard+ 20만·Premium 30만 원+, VAT 별도)과 이용 코인(매월 1일 KST 리셋·이월 없음)을 기준으로 표시합니다. Standard+는 Premium과 동일한 업무 기능(텔레CRM 제외)에 사용량 한도가 있고, Premium은 코인·팀장·캘린더 무제한·브랜드 2개 포함(3번째부터 월 20만 원, VAT 별도)입니다. 텔레CRM은 모든 플랜에서 별도 옵션입니다. 플랜 변경은 플랫폼 담당자에게 문의해 주세요.';

export function isKnownFeatureModuleId(id: string): id is TenantFeatureModuleId {
  return id in TENANT_FEATURE_MODULES;
}

export { isCustomModuleId, isRegisteredCustomModuleId, customModulesForTenantSlug } from '../custom/customModuleCatalog.js';

/** SK클린텍·cbiseo만 타업체(mod_external_co) 사용 — @see shared/externalCompanyTenantAccess.ts */
export const EXTERNAL_COMPANY_TENANT_SLUGS = ['sk', 'skcleanteck', 'cbiseo'] as const;

export function isExternalCompanyTenantSlug(slug: string | null | undefined): boolean {
  const s = slug?.trim().toLowerCase();
  if (!s) return false;
  return (EXTERNAL_COMPANY_TENANT_SLUGS as readonly string[]).includes(s);
}

export function applyExternalCompanyModuleAccess(
  modules: readonly string[],
  tenantSlug: string | null | undefined,
): string[] {
  if (isExternalCompanyTenantSlug(tenantSlug)) {
    const out = [...modules];
    if (!out.includes('mod_external_co')) out.push('mod_external_co');
    return out;
  }
  return modules.filter((m) => m !== 'mod_external_co');
}
