/**
 * L1 테넌트 설정 — UI 문구·한도·기본값 (JSON `Tenant.config`)
 * @see docs/MULTI_TENANT_PLATFORM.md §5
 */

export type TenantBrandingConfig = {
  /** 로그인·GNB 등에 쓸 표시명 (미설정 시 Tenant.name) */
  displayName?: string;
  loginSubtitle?: string;
};

export type TenantOrderFormConfig = {
  /** 고객 발주서 상단 부제 */
  publicSubtitle?: string;
};

import type { OperatingCompanyPolicy } from './operatingCompanyConfig.js';

export type { OperatingCompanyPolicy } from './operatingCompanyConfig.js';
export { DEFAULT_OPERATING_COMPANY_POLICY } from './operatingCompanyConfig.js';

export type TenantInquiryConfig = {
  /** 접수번호 접두 (예: SK-) — 미구현 시 서버 기본 규칙 유지 */
  numberPrefix?: string;
};

import type { TenantInspectionTemplateConfig } from './inquiryInspectionTenantTemplate.js';
import type { TenantAccessConfig } from './staffAccess.js';

export type TenantConfig = {
  branding?: TenantBrandingConfig;
  orderForm?: TenantOrderFormConfig;
  inquiry?: TenantInquiryConfig;
  /** 테넌트 전역 영업 브랜드 정책(배정·팀장 목록·접수 기본 귀속). 브랜딩 JSON은 OperatingCompany.config */
  operatingCompanyPolicy?: OperatingCompanyPolicy;
  /** 현장 검수 체크리스트 세부 항목 템플릿 */
  inspection?: TenantInspectionTemplateConfig;
  /** 직원 권한 — 마케터 관리자 승격 등 */
  access?: TenantAccessConfig;
};

export const EMPTY_TENANT_CONFIG: TenantConfig = {};

/** 영업 브랜드 정책 필드 힌트 — `Tenant.config.operatingCompanyPolicy` */
export const OPERATING_COMPANY_POLICY_FIELD_HINTS = {
  'operatingCompanyPolicy.assignmentMode':
    '배정 모드 — strict: 접수 브랜드 소속 팀장만 / relaxed: 테넌트 전체 팀장 허용',
  'operatingCompanyPolicy.teamLeaderListMode':
    '팀장 목록 — own_brands_only: 소속 브랜드 접수만 / tenant_all_read: 테넌트 전체 조회',
  'operatingCompanyPolicy.inquiryDefaultMode':
    '접수 기본 귀속 — user_primary·creator_primary·from_intake_url(?brand=)',
} as const;

/** 플랫폼 UI·문서용 L1 필드 힌트 (L1 branding은 프로비저닝 시 기본 영업 브랜드로 복사됨) */
export const TENANT_CONFIG_FIELD_HINTS = {
  'branding.displayName': '로그인·헤더 표시명 (기본 영업 브랜드 초기값)',
  'branding.loginSubtitle': '로그인 화면 부제',
  'orderForm.publicSubtitle': '고객 발주서 부제 (기본 영업 브랜드 초기값)',
  'inquiry.numberPrefix': '접수번호 접두 (예: SK-, 브랜드별 prefix는 OperatingCompany.config)',
  'inspection.areaItems': '현장 검수 구역별 세부 항목 템플릿 (관리자 UI에서 편집)',
  ...OPERATING_COMPANY_POLICY_FIELD_HINTS,
} as const;

/** 플랫폼 L1 설정 폼 — JSON 없이 편집 */
export type TenantConfigFormFields = {
  displayName: string;
  loginSubtitle: string;
  orderFormPublicSubtitle: string;
  inquiryNumberPrefix: string;
};

export const EMPTY_TENANT_CONFIG_FORM: TenantConfigFormFields = {
  displayName: '',
  loginSubtitle: '',
  orderFormPublicSubtitle: '',
  inquiryNumberPrefix: '',
};

function asTenantConfig(raw: unknown): TenantConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as TenantConfig;
}

export function formFieldsFromTenantConfig(raw: unknown): TenantConfigFormFields {
  const c = asTenantConfig(raw);
  return {
    displayName: c.branding?.displayName ?? '',
    loginSubtitle: c.branding?.loginSubtitle ?? '',
    orderFormPublicSubtitle: c.orderForm?.publicSubtitle ?? '',
    inquiryNumberPrefix: c.inquiry?.numberPrefix ?? '',
  };
}

/** 빈 칸은 해당 섹션을 비움(저장 시 제거) */
export function tenantConfigFromFormFields(fields: TenantConfigFormFields): TenantConfig {
  const displayName = fields.displayName.trim();
  const loginSubtitle = fields.loginSubtitle.trim();
  const publicSubtitle = fields.orderFormPublicSubtitle.trim();
  const numberPrefix = fields.inquiryNumberPrefix.trim();

  const config: TenantConfig = {};

  if (displayName || loginSubtitle) {
    config.branding = {
      ...(displayName ? { displayName } : {}),
      ...(loginSubtitle ? { loginSubtitle } : {}),
    };
  } else {
    config.branding = {};
  }

  if (publicSubtitle) {
    config.orderForm = { publicSubtitle };
  } else {
    config.orderForm = {};
  }

  if (numberPrefix) {
    config.inquiry = { numberPrefix };
  } else {
    config.inquiry = {};
  }

  return config;
}
