/**
 * 테넌트 기능 모듈 카탈로그 — 플랜·on/off·GNB/API 가드 공통 ID.
 * @see docs/MULTI_TENANT_PLATFORM.md
 */
import { normalizePlanId } from './tenantPlanNormalize.js';

export const TENANT_FEATURE_MODULES = {
  core_inquiries: {
    label: '서비스접수·발주서',
    tier: 'core' as const,
    defaultOn: true,
    upsellDescription: '손님 접수와 발주서를 한곳에서 다룹니다.',
  },
  core_schedule: {
    label: '스케줄',
    tier: 'core' as const,
    defaultOn: true,
    upsellDescription: '날짜별 오전·오후 일정을 봅니다.',
  },
  core_assignments: {
    label: '배정',
    tier: 'core' as const,
    defaultOn: true,
    upsellDescription: '직원이 생기면 — Standard부터',
  },
  core_messages: {
    label: '메시지',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '직원과 메시지를 주고받습니다.',
  },
  mod_cs: {
    label: 'C/S 관리',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '청소 후 고객 문의를 한곳에서 처리합니다.',
  },
  mod_advertising: {
    label: '광고비',
    tier: 'standard' as const,
    defaultOn: false,
    upsellDescription: '광고 채널별 비용을 모읍니다.',
  },
  mod_payroll: {
    label: '급여·정산',
    tier: 'premium' as const,
    defaultOn: false,
    upsellDescription: '직원 급여와 월정산을 만듭니다.',
  },
  mod_e_contract: {
    label: '전자계약',
    tier: 'premium' as const,
    defaultOn: false,
    upsellDescription: '계약서를 보내고 서명을 받습니다.',
  },
  mod_external_co: {
    label: '타업체·외부정산',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '다른 업체에 일을 넘기고 정산합니다.',
  },
  mod_tenant_exchange: {
    label: '파트너 접수 연계',
    tier: 'premium' as const,
    defaultOn: false,
    upsellDescription: '파트너 업체와 접수를 주고받습니다.',
  },
  mod_db_marketplace: {
    label: '정보공유(DB 마켓)',
    tier: 'standard' as const,
    defaultOn: false,
    upsellDescription: '청소 일감을 다른 업체와 나눕니다.',
  },
  mod_crew: {
    label: '크루(현장)',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '현장 직원이 앱으로 일정을 봅니다.',
  },
  mod_team_stats: {
    label: '팀장 통계',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '팀장별 실적을 봅니다.',
  },
  mod_inspection: {
    label: '현장 검수',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '청소 전후 사진을 검수합니다.',
  },
  mod_telecrm: {
    label: '텔레CRM',
    tier: 'premium' as const,
    defaultOn: false,
    upsellDescription: '전화와 문자를 접수와 연결합니다.',
  },
  mod_landing_inquiry: {
    label: '랜딩 문의내역',
    tier: 'premium' as const,
    defaultOn: false,
    upsellDescription: '홈페이지 문의를 접수로 받습니다.',
  },
  mod_quick_paste: {
    label: '빠른등록',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '문자 내용을 붙여 접수를 만듭니다.',
  },
  mod_alimtalk: {
    label: '알림톡',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '고객에게 알림톡을 보냅니다.',
  },
  mod_card_payment: {
    label: '카드결재',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '카드로 대금을 받습니다.',
  },
  mod_cashbill: {
    label: '현금영수증',
    tier: 'standard' as const,
    defaultOn: true,
    upsellDescription: '현금영수증을 발행하려면 브랜드별 회원사 가입이 필요합니다.',
  },
  mod_ai_dispatch: {
    label: 'AI 미리 배정',
    tier: 'premium' as const,
    defaultOn: false,
    upsellDescription: '일정에 맞춰 팀을 미리 제안합니다.',
  },
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
  'mod_card_payment',
  'mod_cashbill',
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
      'mod_card_payment',
      'mod_cashbill',
    ] as TenantFeatureModuleId[],
  },
  standard_plus: {
    label: 'Standard+',
    modules: [...TENANT_PREMIUM_BUSINESS_MODULE_IDS],
  },
  premium: {
    label: 'Premium',
    modules: [...TENANT_PREMIUM_BUSINESS_MODULE_IDS, 'mod_ai_dispatch'] as TenantFeatureModuleId[],
  },
} as const;

export type TenantPlanId = keyof typeof TENANT_PLANS;

/** SK클린텍 기존 데이터 백필·로컬 기본 테넌트 */
export const DEFAULT_TENANT_SLUG = 'skcleanteck';

export function modulesForPlan(plan: string): TenantFeatureModuleId[] {
  const p = normalizePlanId(plan);
  return [...TENANT_PLANS[p].modules];
}

export function hasFeature(enabled: readonly string[], moduleId: TenantFeatureModuleId): boolean {
  return enabled.includes(moduleId);
}

export function moduleUpsellDescription(moduleId: TenantFeatureModuleId): string {
  return TENANT_FEATURE_MODULES[moduleId].upsellDescription;
}

/** 관리자·마케터 GNB id → 기능 모듈 (null = 플랜과 무관하게 항상 표시) */
export const ADMIN_NAV_MODULE_MAP = {
  dashboard: null,
  inquiries: 'core_inquiries',
  schedule: 'core_schedule',
  'team-leaders': null,
  advertising: 'mod_advertising',
  messages: 'core_messages',
  'db-marketplace': 'mod_db_marketplace',
  telecrm: 'mod_telecrm',
} as const satisfies Record<string, TenantFeatureModuleId | null>;

export type AdminNavFeatureId = keyof typeof ADMIN_NAV_MODULE_MAP;
