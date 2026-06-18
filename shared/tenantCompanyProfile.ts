/**
 * 테넌트 업체등록정보 + SMTP (Tenant.config L1)
 * SMTP 비밀번호는 서버에서만 암호화 저장 — API에는 노출하지 않음
 */

import type { QuotationSealFields } from './quotationSealFields.js';

export type TenantCompanyRegistration = {
  companyName?: string;
  representativeName?: string;
  businessRegistrationNo?: string;
  addressLine?: string;
  phone?: string;
  fax?: string;
  /** 업체 대표 연락 이메일 (발송 SMTP 발신 주소와 다를 수 있음) */
  contactEmail?: string;
} & QuotationSealFields;

/** API 응답용 — 비밀번호 제외 */
export type TenantSmtpSettingsPublic = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  passwordConfigured: boolean;
  configured: boolean;
};

export type TenantCompanyProfileDto = {
  companyRegistration: TenantCompanyRegistration;
  smtp: TenantSmtpSettingsPublic;
  /** Railway 등 서버 전역 SMTP fallback 사용 가능 여부 */
  globalSmtpFallbackAvailable: boolean;
  /** 활성 영업 브랜드별 SMTP (없으면 공통 기본 사용) */
  operatingCompanySmtpSettings: OperatingCompanySmtpSetting[];
};

export type OperatingCompanySmtpSetting = {
  id: string;
  name: string;
  displayName: string;
  smtp: TenantSmtpSettingsPublic;
  hasOwnSmtp: boolean;
  effectiveConfigured: boolean;
};

export type TenantCompanyProfilePatch = {
  /** 지정 시 해당 브랜드 config.smtp 만 수정 (공통 기본은 operatingCompanyId 생략) */
  operatingCompanyId?: string | null;
  companyRegistration?: Partial<
    Omit<TenantCompanyRegistration, 'sealPublicId' | 'sealSecureUrl' | 'sealDisplayWidthPx'>
  > & {
    sealPublicId?: string | null;
    sealSecureUrl?: string | null;
    sealDisplayWidthPx?: number | null;
  };
  smtp?: {
    host?: string;
    port?: number | null;
    secure?: boolean;
    user?: string;
    from?: string;
    /** 비워 두면 기존 비밀번호 유지. 새 설정 시 필수 */
    password?: string;
  };
};
