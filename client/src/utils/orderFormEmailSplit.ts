import { EMAIL_DOMAIN_CUSTOM, KR_EMAIL_DOMAINS } from '../constants/krEmailDomains';

const KNOWN = new Set<string>(KR_EMAIL_DOMAINS);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OrderFormEmailSplit = {
  local: string;
  domainKey: string;
  customDomain: string;
};

/** 전각 @·마침표, 보이지 않는 문자, 공백을 걷어 주소 한 줄로 맞춘다. */
export function normalizeOrderFormEmailInput(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function parseOrderFormEmailSplit(raw: string): OrderFormEmailSplit {
  const t = normalizeOrderFormEmailInput(raw);
  const at = t.lastIndexOf('@');
  if (at < 0) {
    return { local: t, domainKey: '', customDomain: '' };
  }
  const local = t.slice(0, at);
  const domain = t.slice(at + 1).replace(/^@+/, '');
  if (!domain) {
    return { local, domainKey: '', customDomain: '' };
  }
  if (KNOWN.has(domain)) {
    return { local, domainKey: domain, customDomain: '' };
  }
  return { local, domainKey: EMAIL_DOMAIN_CUSTOM, customDomain: domain };
}

export function joinOrderFormEmailSplit(local: string, domainKey: string, customDomain: string): string {
  const l = normalizeOrderFormEmailInput(local);
  const d =
    domainKey === EMAIL_DOMAIN_CUSTOM
      ? normalizeOrderFormEmailInput(customDomain).replace(/^@+/, '')
      : domainKey.trim().toLowerCase();
  if (!l && !d) return '';
  if (!d) return l;
  return `${l}@${d}`;
}

export function isCompleteOrderFormEmail(raw: string): boolean {
  const email = normalizeOrderFormEmailInput(raw);
  return email.length > 0 && email.length <= 320 && EMAIL_RE.test(email);
}

/** 비어 있으면 입력 안내, @가 없으면 주소 선택 안내, 그 외는 형식 안내. */
export function orderFormEmailFormatError(raw: string): string | null {
  const email = normalizeOrderFormEmailInput(raw);
  if (!email) return '이메일을 입력해 주세요.';
  if (!email.includes('@')) {
    return '메일 주소를 고르거나 name@도메인 형식으로 입력해 주세요.';
  }
  if (email.length > 320 || !EMAIL_RE.test(email)) return '이메일 형식이 올바르지 않습니다.';
  return null;
}
