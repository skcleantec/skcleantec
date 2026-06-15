/**
 * 테넌트 업체등록정보 + SMTP (Tenant.config L1)
 * SMTP 비밀번호는 서버에서만 암호화 저장 — API에는 노출하지 않음
 */

export type TenantCompanyRegistration = {
  companyName?: string;
  representativeName?: string;
  businessRegistrationNo?: string;
  addressLine?: string;
  phone?: string;
  fax?: string;
  /** 업체 대표 연락 이메일 (발송 SMTP 발신 주소와 다를 수 있음) */
  contactEmail?: string;
};

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
};

export type TenantCompanyProfilePatch = {
  companyRegistration?: Partial<TenantCompanyRegistration>;
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
