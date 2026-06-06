/**
 * 영업 업체(OperatingCompany) L2 설정 — `OperatingCompany.config`
 */

export type OperatingCompanyBrandingConfig = {
  displayName?: string;
  loginSubtitle?: string;
};

export type OperatingCompanyOrderFormConfig = {
  publicSubtitle?: string;
};

export type OperatingCompanyInquiryConfig = {
  numberPrefix?: string;
};

export type OperatingCompanyConfig = {
  branding?: OperatingCompanyBrandingConfig;
  orderForm?: OperatingCompanyOrderFormConfig;
  inquiry?: OperatingCompanyInquiryConfig;
};

export const EMPTY_OPERATING_COMPANY_CONFIG: OperatingCompanyConfig = {};

export type OperatingCompanyAssignmentMode = 'strict' | 'relaxed';
export type OperatingCompanyTeamLeaderListMode = 'own_brands_only' | 'tenant_all_read';
export type OperatingCompanyInquiryDefaultMode =
  | 'user_primary'
  | 'from_intake_url'
  | 'creator_primary';

/** 테넌트 전역 1세트 — `Tenant.config.operatingCompanyPolicy` */
export type OperatingCompanyPolicy = {
  assignmentMode?: OperatingCompanyAssignmentMode;
  teamLeaderListMode?: OperatingCompanyTeamLeaderListMode;
  inquiryDefaultMode?: OperatingCompanyInquiryDefaultMode;
};

export const DEFAULT_OPERATING_COMPANY_POLICY: Required<OperatingCompanyPolicy> = {
  assignmentMode: 'relaxed',
  teamLeaderListMode: 'tenant_all_read',
  inquiryDefaultMode: 'user_primary',
};
