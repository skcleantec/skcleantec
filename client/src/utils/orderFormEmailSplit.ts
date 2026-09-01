import { EMAIL_DOMAIN_CUSTOM, KR_EMAIL_DOMAINS } from '../constants/krEmailDomains';

const KNOWN = new Set<string>(KR_EMAIL_DOMAINS);

export type OrderFormEmailSplit = {
  local: string;
  domainKey: string;
  customDomain: string;
};

export function parseOrderFormEmailSplit(raw: string): OrderFormEmailSplit {
  const t = raw.trim();
  const at = t.lastIndexOf('@');
  if (at < 0) {
    return { local: t, domainKey: '', customDomain: '' };
  }
  const local = t.slice(0, at);
  const domain = t.slice(at + 1).replace(/^@+/, '').toLowerCase();
  if (!domain) {
    return { local, domainKey: '', customDomain: '' };
  }
  if (KNOWN.has(domain)) {
    return { local, domainKey: domain, customDomain: '' };
  }
  return { local, domainKey: EMAIL_DOMAIN_CUSTOM, customDomain: domain };
}

export function joinOrderFormEmailSplit(local: string, domainKey: string, customDomain: string): string {
  const l = local.trim();
  const d =
    domainKey === EMAIL_DOMAIN_CUSTOM
      ? customDomain.trim().replace(/^@+/, '').toLowerCase()
      : domainKey.trim().toLowerCase();
  if (!l && !d) return '';
  if (!d) return l;
  return `${l}@${d}`;
}
