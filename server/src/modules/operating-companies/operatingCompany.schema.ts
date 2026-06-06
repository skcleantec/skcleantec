/**
 * OperatingCompany.config 파싱 — shared/operatingCompanyConfig.ts 와 동기화
 */

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
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const publicSubtitle = trimOptionalString(o.publicSubtitle, MAX_STRING);
  if (!publicSubtitle) return undefined;
  return { publicSubtitle };
}

function parseInquiry(raw: unknown): OperatingCompanyConfig['inquiry'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const numberPrefix = trimOptionalString(o.numberPrefix, MAX_PREFIX);
  if (!numberPrefix) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(numberPrefix)) {
    throw new Error('inquiry.numberPrefix는 영문·숫자·_- 만 사용할 수 있습니다.');
  }
  return { numberPrefix };
}

export function parseOperatingCompanyConfig(raw: unknown): OperatingCompanyConfig {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config는 JSON 객체여야 합니다.');
  }
  const o = raw as Record<string, unknown>;
  const branding = parseBranding(o.branding);
  const orderForm = parseOrderForm(o.orderForm);
  const inquiry = parseInquiry(o.inquiry);
  const out: OperatingCompanyConfig = {};
  if (branding) out.branding = branding;
  if (orderForm) out.orderForm = orderForm;
  if (inquiry) out.inquiry = inquiry;
  return out;
}

export function mergeOperatingCompanyConfig(
  existing: OperatingCompanyConfig,
  patch: OperatingCompanyConfig,
): OperatingCompanyConfig {
  return {
    branding: patch.branding !== undefined ? patch.branding : existing.branding,
    orderForm: patch.orderForm !== undefined ? patch.orderForm : existing.orderForm,
    inquiry: patch.inquiry !== undefined ? patch.inquiry : existing.inquiry,
  };
}

export function operatingCompanyConfigToJson(config: OperatingCompanyConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config.branding && Object.keys(config.branding).length > 0) out.branding = config.branding;
  if (config.orderForm && Object.keys(config.orderForm).length > 0) out.orderForm = config.orderForm;
  if (config.inquiry && Object.keys(config.inquiry).length > 0) out.inquiry = config.inquiry;
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
