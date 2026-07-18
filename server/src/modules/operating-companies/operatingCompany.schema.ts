/**
 * OperatingCompany.config 파싱 — shared/operatingCompanyConfig.ts 와 동기화
 */

import { parseSmtpConfigStored } from '../../lib/smtpConfigStored.js';
import {
  parseOperatingCompanySoomgoStored,
  soomgoPublicFromStored,
  type OperatingCompanySoomgoStored,
} from '../../lib/operatingCompanySoomgoConfig.js';
import { resolveQuotationSealDisplayWidth, tenantCompanySealLooksValid } from '../../lib/quotationSeal.js';
import type {
  TenantCompanyRegistrationConfig,
  TenantSmtpConfigStored,
} from '../tenants/tenantConfig.schema.js';

/** shared/operatingCompanyConfig.ts OPERATING_COMPANY_BADGE_COLOR_KEYS 와 동기화 */
export const OPERATING_COMPANY_BADGE_COLOR_KEYS = [
  'indigo',
  'emerald',
  'amber',
  'rose',
  'sky',
  'violet',
  'teal',
  'orange',
  'fuchsia',
  'cyan',
] as const;

export type OperatingCompanyBadgeColorKey = (typeof OPERATING_COMPANY_BADGE_COLOR_KEYS)[number];

export type OperatingCompanyBrandingConfig = {
  displayName?: string;
  loginSubtitle?: string;
  badgeColorKey?: OperatingCompanyBadgeColorKey;
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
  companyRegistration?: Partial<TenantCompanyRegistrationConfig>;
  smtp?: TenantSmtpConfigStored;
  /** 텔레CRM 숨고 — 브랜드별 계정 (DB 저장 · passwordEnc) */
  soomgo?: OperatingCompanySoomgoStored;
};

/** API 응답용 — 비밀번호 암호문 제외 */
export type OperatingCompanySoomgoConfigPublic = {
  email?: string;
  enabled?: boolean;
  hasPassword?: boolean;
  configured?: boolean;
  loginMode?: 'email' | 'kakao';
}

export type OperatingCompanyConfigPublic = Omit<OperatingCompanyConfig, 'soomgo' | 'smtp'> & {
  smtp?: TenantSmtpConfigStored;
  soomgo?: OperatingCompanySoomgoConfigPublic;
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

function parseBadgeColorKey(raw: unknown): OperatingCompanyBadgeColorKey | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'string') return undefined;
  const key = raw.trim() as OperatingCompanyBadgeColorKey;
  if (!OPERATING_COMPANY_BADGE_COLOR_KEYS.includes(key)) {
    throw new Error('branding.badgeColorKey가 올바르지 않습니다.');
  }
  return key;
}

function parseBranding(raw: unknown): OperatingCompanyConfig['branding'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const displayName = trimOptionalString(o.displayName, MAX_STRING);
  const loginSubtitle = trimOptionalString(o.loginSubtitle, MAX_STRING);
  const badgeColorKey = parseBadgeColorKey(o.badgeColorKey);
  if (!displayName && !loginSubtitle && !badgeColorKey) return undefined;
  return { displayName, loginSubtitle, badgeColorKey };
}

function parseOrderForm(raw: unknown): OperatingCompanyConfig['orderForm'] | undefined {
  if (raw === undefined) return undefined;
  if (raw == null || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)) {
    return undefined;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const publicSubtitle = trimOptionalString(o.publicSubtitle, MAX_STRING);
  if (!publicSubtitle) return undefined;
  return { publicSubtitle };
}

function parseInquiry(raw: unknown): OperatingCompanyConfig['inquiry'] | undefined {
  if (raw === undefined) return undefined;
  if (raw == null || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)) {
    return undefined;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const numberPrefix = trimOptionalString(o.numberPrefix, MAX_PREFIX);
  if (!numberPrefix) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(numberPrefix)) {
    throw new Error('inquiry.numberPrefix는 영문·숫자·_- 만 사용할 수 있습니다.');
  }
  return { numberPrefix };
}

const COMPANY_REG_KEYS = [
  'companyName',
  'representativeName',
  'businessRegistrationNo',
  'addressLine',
  'phone',
  'fax',
  'contactEmail',
  'sealPublicId',
  'sealSecureUrl',
] as const satisfies readonly (keyof TenantCompanyRegistrationConfig)[];

function parseCompanyRegistration(
  raw: unknown,
): OperatingCompanyConfig['companyRegistration'] | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)) {
    return {};
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<TenantCompanyRegistrationConfig> = {};
  for (const key of COMPANY_REG_KEYS) {
    if (!(key in o)) continue;
    if (o[key] === null) {
      out[key] = '';
      continue;
    }
    const v = trimOptionalString(o[key], key === 'sealSecureUrl' ? 2048 : key === 'sealPublicId' ? 512 : MAX_STRING);
    if (v) out[key] = v;
    else if (key === 'sealPublicId' || key === 'sealSecureUrl') out[key] = '';
  }
  if ('sealDisplayWidthPx' in o) {
    if (o.sealDisplayWidthPx === null) {
      delete out.sealDisplayWidthPx;
    } else if (typeof o.sealDisplayWidthPx === 'number' && Number.isFinite(o.sealDisplayWidthPx)) {
      out.sealDisplayWidthPx = resolveQuotationSealDisplayWidth(o.sealDisplayWidthPx);
    }
  }
  return Object.keys(out).length > 0 ? out : {};
}

function finalizeCompanyRegistrationSection(
  reg: Partial<TenantCompanyRegistrationConfig> | undefined,
  tenantId: string,
): OperatingCompanyConfig['companyRegistration'] | undefined {
  if (!reg || Object.keys(reg).length === 0) return undefined;
  const merged: Partial<TenantCompanyRegistrationConfig> = { ...reg };
  for (const key of COMPANY_REG_KEYS) {
    const v = merged[key];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) merged[key] = t;
      else delete merged[key];
    }
  }
  const pid = merged.sealPublicId?.trim();
  const surl = merged.sealSecureUrl?.trim();
  if (pid || surl) {
    if (!pid || !surl || !tenantCompanySealLooksValid(pid, surl, tenantId)) {
      throw new Error('companyRegistration.seal이 올바르지 않습니다. 직인을 다시 업로드해 주세요.');
    }
    merged.sealPublicId = pid.slice(0, 512);
    merged.sealSecureUrl = surl.slice(0, 2048);
    if (typeof merged.sealDisplayWidthPx === 'number' && Number.isFinite(merged.sealDisplayWidthPx)) {
      merged.sealDisplayWidthPx = resolveQuotationSealDisplayWidth(merged.sealDisplayWidthPx);
    } else {
      delete merged.sealDisplayWidthPx;
    }
  } else {
    delete merged.sealPublicId;
    delete merged.sealSecureUrl;
    delete merged.sealDisplayWidthPx;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeCompanyRegistrationSection(
  existing: OperatingCompanyConfig['companyRegistration'] | undefined,
  patch: OperatingCompanyConfig['companyRegistration'] | undefined,
): OperatingCompanyConfig['companyRegistration'] | undefined {
  if (patch === undefined) return existing;
  if (!patch || Object.keys(patch).length === 0) return existing;
  const merged: Partial<TenantCompanyRegistrationConfig> = { ...(existing ?? {}), ...patch };
  for (const key of COMPANY_REG_KEYS) {
    const v = merged[key];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) merged[key] = t;
      else delete merged[key];
    }
  }
  if ('sealDisplayWidthPx' in patch) {
    if (patch.sealDisplayWidthPx === undefined) {
      // no-op unless seal removed
    } else if (typeof patch.sealDisplayWidthPx === 'number' && Number.isFinite(patch.sealDisplayWidthPx)) {
      merged.sealDisplayWidthPx = resolveQuotationSealDisplayWidth(patch.sealDisplayWidthPx);
    } else {
      delete merged.sealDisplayWidthPx;
    }
  }
  if (!merged.sealPublicId?.trim() || !merged.sealSecureUrl?.trim()) {
    delete merged.sealPublicId;
    delete merged.sealSecureUrl;
    delete merged.sealDisplayWidthPx;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function parseOperatingCompanyConfig(raw: unknown): OperatingCompanyConfig {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config는 JSON 객체여야 합니다.');
  }
  const o = raw as Record<string, unknown>;
  const branding = parseBranding(o.branding);
  const out: OperatingCompanyConfig = {};
  if (branding) out.branding = branding;
  if ('orderForm' in o) {
    out.orderForm = parseOrderForm(o.orderForm);
  }
  if ('inquiry' in o) {
    out.inquiry = parseInquiry(o.inquiry);
  } else {
    const inquiry = parseInquiry(o.inquiry);
    if (inquiry) out.inquiry = inquiry;
  }
  if ('companyRegistration' in o) {
    out.companyRegistration = parseCompanyRegistration(o.companyRegistration) ?? {};
  }
  const smtp = parseSmtpConfigStored(o.smtp);
  if (smtp) out.smtp = smtp;
  const soomgo = parseOperatingCompanySoomgoStored(o.soomgo);
  if (soomgo) out.soomgo = soomgo;
  return out;
}

export function operatingCompanyConfigPublic(config: OperatingCompanyConfig): OperatingCompanyConfigPublic {
  const pub: OperatingCompanyConfigPublic = { ...config };
  if (config.soomgo) {
    pub.soomgo = soomgoPublicFromStored(config.soomgo);
  }
  if (config.smtp?.passEnc) {
    pub.smtp = { ...config.smtp, passEnc: undefined };
  }
  return pub;
}

export function mergeOperatingCompanyConfig(
  existing: OperatingCompanyConfig,
  patch: OperatingCompanyConfig,
  tenantId?: string,
): OperatingCompanyConfig {
  const merged: OperatingCompanyConfig = {
    branding: patch.branding !== undefined ? patch.branding : existing.branding,
    orderForm: patch.orderForm !== undefined ? patch.orderForm : existing.orderForm,
    inquiry: patch.inquiry !== undefined ? patch.inquiry : existing.inquiry,
    companyRegistration:
      patch.companyRegistration !== undefined
        ? mergeCompanyRegistrationSection(existing.companyRegistration, patch.companyRegistration)
        : existing.companyRegistration,
    smtp: patch.smtp !== undefined ? patch.smtp : existing.smtp,
    soomgo: patch.soomgo !== undefined ? patch.soomgo : existing.soomgo,
  };
  if (tenantId && merged.companyRegistration) {
    merged.companyRegistration = finalizeCompanyRegistrationSection(merged.companyRegistration, tenantId);
  }
  return merged;
}

export function operatingCompanyConfigToJson(config: OperatingCompanyConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config.branding && Object.keys(config.branding).length > 0) out.branding = config.branding;
  if (config.orderForm && Object.keys(config.orderForm).length > 0) out.orderForm = config.orderForm;
  if (config.inquiry && Object.keys(config.inquiry).length > 0) out.inquiry = config.inquiry;
  if (config.companyRegistration && Object.keys(config.companyRegistration).length > 0) {
    out.companyRegistration = config.companyRegistration;
  }
  if (config.smtp && Object.keys(config.smtp).length > 0) {
    out.smtp = config.smtp;
  }
  if (config.soomgo && Object.keys(config.soomgo).length > 0) {
    out.soomgo = config.soomgo;
  }
  return out;
}

export const OPERATING_COMPANY_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function normalizeOperatingCompanySlug(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('slug는 문자열이어야 합니다.');
  const slug = raw.trim().toLowerCase();
  if (!slug || !OPERATING_COMPANY_SLUG_RE.test(slug)) {
    throw new Error('slug는 영문 소문자·숫자·하이픈(2~48자)만 사용할 수 있습니다.');
  }
  return slug;
}
