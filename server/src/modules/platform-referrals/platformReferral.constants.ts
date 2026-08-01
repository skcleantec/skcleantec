/** 플랫폼 추천인 — 서버 상수 (client는 shared/platformReferral.ts 와 동기화) */

export const PLATFORM_REFERRER_DEFAULT_COMMISSION_RATE_BPS = 500;

export const PLATFORM_REFERRER_RESERVED_CODES = [
  'admin',
  'api',
  'app',
  'cbiseo',
  'crew',
  'help',
  'login',
  'order',
  'platform',
  'ref',
  'refer',
  'referrer',
  'signup',
  'sk',
  'static',
  'team',
  'www',
] as const;

export function formatReferrerCommissionRateBps(bps: number): string {
  if (!Number.isFinite(bps)) return '—';
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export const REFERRER_SIGNUP_SHORT_PATH = '/r';

export function buildReferrerSignupLinks(code: string, baseUrl: string) {
  const normalized = code.trim().toLowerCase();
  const encoded = encodeURIComponent(normalized);
  const origin = baseUrl.replace(/\/$/, '');
  return {
    shortLink: `${origin}${REFERRER_SIGNUP_SHORT_PATH}/${encoded}`,
    fullLink: `${origin}/signup?ref=${encoded}`,
  };
}
