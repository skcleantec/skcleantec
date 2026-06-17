/**
 * L1 Tenant.config 파싱 — shared/tenantConfig.ts 와 타입 동기화
 * @see docs/MULTI_TENANT_PLATFORM.md
 */

export type TenantBrandingConfig = {
  displayName?: string;
  loginSubtitle?: string;
};

export type TenantOrderFormConfig = {
  publicSubtitle?: string;
};

export type TenantInquiryConfig = {
  numberPrefix?: string;
};

/** 업체등록정보 — 사업자·연락처·견적 직인 */
export type TenantCompanyRegistrationConfig = {
  companyName?: string;
  representativeName?: string;
  businessRegistrationNo?: string;
  addressLine?: string;
  phone?: string;
  fax?: string;
  contactEmail?: string;
  sealPublicId?: string;
  sealSecureUrl?: string;
  sealDisplayWidthPx?: number;
};

/** SMTP — passEnc는 서버 전용 (암호화 저장) */
export type TenantSmtpConfigStored = {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  from?: string;
  passEnc?: string;
};

import type { OperatingCompanyPolicy } from '../operating-companies/operatingCompanyPolicy.js';
import {
  sanitizeTenantInspectionAreaItems,
  type TenantInspectionTemplateConfig,
} from '../../lib/inquiryInspectionTenantTemplate.js';

export type TenantConfig = {
  branding?: TenantBrandingConfig;
  orderForm?: TenantOrderFormConfig;
  inquiry?: TenantInquiryConfig;
  operatingCompanyPolicy?: OperatingCompanyPolicy;
  inspection?: TenantInspectionTemplateConfig;
  companyRegistration?: TenantCompanyRegistrationConfig;
  smtp?: TenantSmtpConfigStored;
};

const MAX_STRING = 512;
const MAX_PREFIX = 16;

function trimOptionalString(raw: unknown, maxLen: number): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  return v.slice(0, maxLen);
}

function parseBranding(raw: unknown): TenantConfig['branding'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const displayName = trimOptionalString(o.displayName, MAX_STRING);
  const loginSubtitle = trimOptionalString(o.loginSubtitle, MAX_STRING);
  if (!displayName && !loginSubtitle) return undefined;
  return { displayName, loginSubtitle };
}

function parseOrderForm(raw: unknown): TenantConfig['orderForm'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const publicSubtitle = trimOptionalString(o.publicSubtitle, MAX_STRING);
  if (!publicSubtitle) return undefined;
  return { publicSubtitle };
}

function parseInquiry(raw: unknown): TenantConfig['inquiry'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const numberPrefix = trimOptionalString(o.numberPrefix, MAX_PREFIX);
  if (!numberPrefix) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(numberPrefix)) {
    throw new Error('inquiry.numberPrefix는 영문·숫자·_- 만 사용할 수 있습니다.');
  }
  return { numberPrefix };
}

function parseOperatingCompanyPolicySection(raw: unknown): TenantConfig['operatingCompanyPolicy'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const po = raw as Record<string, unknown>;
  const out: OperatingCompanyPolicy = {};
  if (po.assignmentMode === 'strict' || po.assignmentMode === 'relaxed') {
    out.assignmentMode = po.assignmentMode;
  }
  if (po.teamLeaderListMode === 'own_brands_only' || po.teamLeaderListMode === 'tenant_all_read') {
    out.teamLeaderListMode = po.teamLeaderListMode;
  }
  if (
    po.inquiryDefaultMode === 'user_primary' ||
    po.inquiryDefaultMode === 'from_intake_url' ||
    po.inquiryDefaultMode === 'creator_primary'
  ) {
    out.inquiryDefaultMode = po.inquiryDefaultMode;
  }
  if (Object.keys(out).length === 0) return undefined;
  return out;
}

function parseInspection(raw: unknown): TenantConfig['inspection'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (!o.areaItems) return undefined;
  try {
    const areaItems = sanitizeTenantInspectionAreaItems(o.areaItems);
    if (Object.keys(areaItems).length === 0) return undefined;
    return { areaItems };
  } catch {
    return undefined;
  }
}

function parseCompanyRegistration(raw: unknown): TenantConfig['companyRegistration'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const companyName = trimOptionalString(o.companyName, MAX_STRING);
  const representativeName = trimOptionalString(o.representativeName, MAX_STRING);
  const businessRegistrationNo = trimOptionalString(o.businessRegistrationNo, 32);
  const addressLine = trimOptionalString(o.addressLine, MAX_STRING);
  const phone = trimOptionalString(o.phone, 32);
  const fax = trimOptionalString(o.fax, 32);
  const contactEmail = trimOptionalString(o.contactEmail, MAX_STRING);
  const sealPublicId = trimOptionalString(o.sealPublicId, 512);
  const sealSecureUrl = trimOptionalString(o.sealSecureUrl, 2048);
  let sealDisplayWidthPx: number | undefined;
  if (typeof o.sealDisplayWidthPx === 'number' && Number.isFinite(o.sealDisplayWidthPx)) {
    sealDisplayWidthPx = Math.min(96, Math.max(32, Math.round(o.sealDisplayWidthPx)));
  }
  if (
    !companyName &&
    !representativeName &&
    !businessRegistrationNo &&
    !addressLine &&
    !phone &&
    !fax &&
    !contactEmail &&
    !sealPublicId &&
    !sealSecureUrl &&
    sealDisplayWidthPx === undefined
  ) {
    return undefined;
  }
  return {
    companyName,
    representativeName,
    businessRegistrationNo,
    addressLine,
    phone,
    fax,
    contactEmail,
    sealPublicId,
    sealSecureUrl,
    sealDisplayWidthPx,
  };
}

function parseSmtpStored(raw: unknown): TenantConfig['smtp'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const host = trimOptionalString(o.host, MAX_STRING);
  const user = trimOptionalString(o.user, MAX_STRING);
  const from = trimOptionalString(o.from, MAX_STRING);
  const passEnc = trimOptionalString(o.passEnc, 2048);
  let port: number | undefined;
  if (typeof o.port === 'number' && Number.isFinite(o.port)) {
    port = Math.min(65535, Math.max(1, Math.round(o.port)));
  } else if (typeof o.port === 'string' && o.port.trim()) {
    const n = parseInt(o.port, 10);
    if (Number.isFinite(n)) port = Math.min(65535, Math.max(1, n));
  }
  const secure = o.secure === true;
  if (!host && !user && !from && !passEnc && port === undefined) return undefined;
  return { host, port, secure, user, from, passEnc };
}

/** DB JSON → 검증된 TenantConfig (알 수 없는 키는 무시) */
export function parseTenantConfig(raw: unknown): TenantConfig {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config는 JSON 객체여야 합니다.');
  }
  const o = raw as Record<string, unknown>;
  const branding = parseBranding(o.branding);
  const orderForm = parseOrderForm(o.orderForm);
  const inquiry = parseInquiry(o.inquiry);
  const operatingCompanyPolicy = parseOperatingCompanyPolicySection(o.operatingCompanyPolicy);
  const inspection = parseInspection(o.inspection);
  const companyRegistration = parseCompanyRegistration(o.companyRegistration);
  const smtp = parseSmtpStored(o.smtp);
  const out: TenantConfig = {};
  if (branding) out.branding = branding;
  if (orderForm) out.orderForm = orderForm;
  if (inquiry) out.inquiry = inquiry;
  if (operatingCompanyPolicy) out.operatingCompanyPolicy = operatingCompanyPolicy;
  if (inspection) out.inspection = inspection;
  if (companyRegistration) out.companyRegistration = companyRegistration;
  if (smtp) out.smtp = smtp;
  return out;
}

/** PATCH body — 부분 병합 (최상위 섹션 단위) */
export function mergeTenantConfig(existing: TenantConfig, patch: TenantConfig): TenantConfig {
  return {
    branding: patch.branding !== undefined ? patch.branding : existing.branding,
    orderForm: patch.orderForm !== undefined ? patch.orderForm : existing.orderForm,
    inquiry: patch.inquiry !== undefined ? patch.inquiry : existing.inquiry,
    operatingCompanyPolicy:
      patch.operatingCompanyPolicy !== undefined
        ? patch.operatingCompanyPolicy
        : existing.operatingCompanyPolicy,
    inspection: patch.inspection !== undefined ? patch.inspection : existing.inspection,
    companyRegistration:
      patch.companyRegistration !== undefined
        ? patch.companyRegistration
        : existing.companyRegistration,
    smtp: patch.smtp !== undefined ? patch.smtp : existing.smtp,
  };
}

export function tenantConfigToJson(config: TenantConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config.branding && Object.keys(config.branding).length > 0) out.branding = config.branding;
  if (config.orderForm && Object.keys(config.orderForm).length > 0) out.orderForm = config.orderForm;
  if (config.inquiry && Object.keys(config.inquiry).length > 0) out.inquiry = config.inquiry;
  if (config.operatingCompanyPolicy) out.operatingCompanyPolicy = config.operatingCompanyPolicy;
  if (config.inspection?.areaItems && Object.keys(config.inspection.areaItems).length > 0) {
    out.inspection = { areaItems: config.inspection.areaItems };
  }
  if (config.companyRegistration && Object.keys(config.companyRegistration).length > 0) {
    out.companyRegistration = config.companyRegistration;
  }
  if (config.smtp && Object.keys(config.smtp).length > 0) {
    out.smtp = config.smtp;
  }
  return out;
}

/** SaaS 플랫폼명 — 고객 대면(메일 제목·공개 열람) 폴백에서 제외 (@see shared/platformBrand.ts) */
const PLATFORM_BRAND_NAME = '청소비서';

/**
 * 고객 대면 표시명 — 업체등록정보 회사명 우선, 플랫폼명(청소비서)은 사용하지 않음.
 */
export function resolveTenantCustomerFacingBrandName(
  config: TenantConfig,
  tenantName: string,
): string {
  const companyName = config.companyRegistration?.companyName?.trim();
  if (companyName) return companyName;

  const name = tenantName.trim();
  if (name) return name;

  const branding = config.branding?.displayName?.trim();
  if (branding && branding !== PLATFORM_BRAND_NAME) return branding;

  return '업체';
}

export type { TenantConfig as TenantConfigParsed };
