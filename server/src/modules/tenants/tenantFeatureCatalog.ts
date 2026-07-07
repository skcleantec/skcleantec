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
  mod_db_marketplace: { label: '정보공유(DB 마켓)', tier: 'premium' as const, defaultOn: false },
  mod_crew: { label: '크루(현장)', tier: 'standard' as const, defaultOn: true },
  mod_team_stats: { label: '팀장 통계', tier: 'standard' as const, defaultOn: true },
  mod_inspection: { label: '현장 검수', tier: 'standard' as const, defaultOn: true },
  mod_telecrm: { label: '텔레CRM', tier: 'premium' as const, defaultOn: false },
} as const;

export type TenantFeatureModuleId = keyof typeof TENANT_FEATURE_MODULES;

export const TENANT_PLANS = {
  starter: {
    label: 'Starter',
    modules: ['core_inquiries', 'core_schedule', 'core_assignments', 'core_messages'] as TenantFeatureModuleId[],
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
    ] as TenantFeatureModuleId[],
  },
  premium: {
    label: 'Premium',
    modules: [
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
      'mod_telecrm',
    ] as TenantFeatureModuleId[],
  },
} as const;

export type TenantPlanId = keyof typeof TENANT_PLANS;

/** 코어 모듈은 오버라이드로 끌 수 없음 */
export const CORE_FEATURE_MODULE_IDS = new Set<TenantFeatureModuleId>([
  'core_inquiries',
  'core_schedule',
  'core_assignments',
]);

export function modulesForPlan(plan: string): TenantFeatureModuleId[] {
  const p = plan in TENANT_PLANS ? TENANT_PLANS[plan as TenantPlanId] : TENANT_PLANS.standard;
  return [...p.modules];
}

/** @see shared/tenantSubscriptionUsage.ts — 동기화 */
export type TenantUsageMetricId = 'activeUsers' | 'inquiriesThisMonth' | 'operatingBrands';

export const TENANT_USAGE_METRIC_LABELS: Record<TenantUsageMetricId, string> = {
  activeUsers: '활성 업무 계정',
  inquiriesThisMonth: '이번 달 접수',
  operatingBrands: '영업 브랜드',
};

export const TENANT_PLAN_USAGE_LIMITS: Record<
  TenantPlanId,
  Record<TenantUsageMetricId, number | null>
> = {
  starter: { activeUsers: 8, inquiriesThisMonth: 400, operatingBrands: 1 },
  standard: { activeUsers: 25, inquiriesThisMonth: 1_500, operatingBrands: 3 },
  premium: { activeUsers: null, inquiriesThisMonth: null, operatingBrands: null },
};

export function usageLimitForPlan(plan: string, metric: TenantUsageMetricId): number | null {
  const p = plan in TENANT_PLAN_USAGE_LIMITS ? (plan as TenantPlanId) : 'standard';
  return TENANT_PLAN_USAGE_LIMITS[p][metric];
}

/** @see shared/tenantPlanCatalog.ts — 동기화 */
export const TENANT_BILLING_NOTE =
  '월 정액 플랜(Starter 9만·Standard 25만·Premium 40만 원, VAT 별도)에 포함된 업무 계정·접수·브랜드 한도를 기준으로 표시합니다. 포함량 초과분은 별도 과금(계정·접수·브랜드 단위)으로 추후 적용될 예정이며, 플랜 업그레이드는 플랫폼 담당자에게 문의해 주세요.';

export function isKnownFeatureModuleId(id: string): id is TenantFeatureModuleId {
  return id in TENANT_FEATURE_MODULES;
}

export { isCustomModuleId, isRegisteredCustomModuleId, customModulesForTenantSlug } from '../custom/customModuleCatalog.js';
