/**
 * 테넌트 기능 모듈 카탈로그 — 플랜·on/off·GNB/API 가드 공통 ID.
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
  mod_tenant_exchange: { label: '파트너 접수 연계', tier: 'standard' as const, defaultOn: false },
  mod_db_marketplace: { label: '정보공유(DB 마켓)', tier: 'standard' as const, defaultOn: false },
  mod_crew: { label: '크루(현장)', tier: 'standard' as const, defaultOn: true },
  mod_team_stats: { label: '팀장 통계', tier: 'standard' as const, defaultOn: true },
  mod_inspection: { label: '현장 검수', tier: 'standard' as const, defaultOn: true },
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
      'mod_tenant_exchange',
      'mod_db_marketplace',
      'mod_crew',
      'mod_team_stats',
      'mod_inspection',
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
    ] as TenantFeatureModuleId[],
  },
} as const;

export type TenantPlanId = keyof typeof TENANT_PLANS;

/** SK클린텍 기존 데이터 백필·로컬 기본 테넌트 */
export const DEFAULT_TENANT_SLUG = 'skcleanteck';

export function modulesForPlan(plan: string): TenantFeatureModuleId[] {
  const p = plan in TENANT_PLANS ? TENANT_PLANS[plan as TenantPlanId] : TENANT_PLANS.standard;
  return [...p.modules];
}

export function hasFeature(enabled: readonly string[], moduleId: TenantFeatureModuleId): boolean {
  return enabled.includes(moduleId);
}

/** 관리자·마케터 GNB id → 기능 모듈 (null = 플랜과 무관하게 항상 표시) */
export const ADMIN_NAV_MODULE_MAP = {
  dashboard: null,
  inquiries: 'core_inquiries',
  schedule: 'core_schedule',
  'team-leaders': null,
  cs: 'mod_cs',
  advertising: 'mod_advertising',
  messages: 'core_messages',
  'db-marketplace': 'mod_db_marketplace',
} as const satisfies Record<string, TenantFeatureModuleId | null>;

export type AdminNavFeatureId = keyof typeof ADMIN_NAV_MODULE_MAP;
