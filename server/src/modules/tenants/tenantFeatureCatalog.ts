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
  mod_crew: { label: '크루(현장)', tier: 'standard' as const, defaultOn: true },
  mod_team_stats: { label: '팀장 통계', tier: 'standard' as const, defaultOn: true },
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
      'mod_crew',
      'mod_team_stats',
      'mod_advertising',
      'mod_payroll',
      'mod_e_contract',
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

export function isKnownFeatureModuleId(id: string): id is TenantFeatureModuleId {
  return id in TENANT_FEATURE_MODULES;
}

export { isCustomModuleId, isRegisteredCustomModuleId, customModulesForTenantSlug } from '../custom/customModuleCatalog.js';
