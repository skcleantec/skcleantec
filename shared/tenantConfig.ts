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

export type TenantInquiryConfig = {
  /** 접수번호 접두 (예: SK-) — 미구현 시 서버 기본 규칙 유지 */
  numberPrefix?: string;
};

export type TenantConfig = {
  branding?: TenantBrandingConfig;
  orderForm?: TenantOrderFormConfig;
  inquiry?: TenantInquiryConfig;
};

export const EMPTY_TENANT_CONFIG: TenantConfig = {};

/** 플랫폼 UI·문서용 L1 필드 힌트 */
export const TENANT_CONFIG_FIELD_HINTS = {
  'branding.displayName': '로그인·헤더 표시명',
  'branding.loginSubtitle': '로그인 화면 부제',
  'orderForm.publicSubtitle': '고객 발주서 부제',
  'inquiry.numberPrefix': '접수번호 접두 (예: SK-)',
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
