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

export type TenantConfig = {
  branding?: TenantBrandingConfig;
  orderForm?: TenantOrderFormConfig;
  inquiry?: TenantInquiryConfig;
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
  const out: TenantConfig = {};
  if (branding) out.branding = branding;
  if (orderForm) out.orderForm = orderForm;
  if (inquiry) out.inquiry = inquiry;
  return out;
}

/** PATCH body — 부분 병합 (최상위 섹션 단위) */
export function mergeTenantConfig(existing: TenantConfig, patch: TenantConfig): TenantConfig {
  return {
    branding: patch.branding !== undefined ? patch.branding : existing.branding,
    orderForm: patch.orderForm !== undefined ? patch.orderForm : existing.orderForm,
    inquiry: patch.inquiry !== undefined ? patch.inquiry : existing.inquiry,
  };
}

export function tenantConfigToJson(config: TenantConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config.branding && Object.keys(config.branding).length > 0) out.branding = config.branding;
  if (config.orderForm && Object.keys(config.orderForm).length > 0) out.orderForm = config.orderForm;
  if (config.inquiry && Object.keys(config.inquiry).length > 0) out.inquiry = config.inquiry;
  return out;
}

export type { TenantConfig as TenantConfigParsed };
