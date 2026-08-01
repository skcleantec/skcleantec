/** 플랫폼 추천인 기본 수수료율 — 5% */
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

export type PlatformReferrerType = 'INDIVIDUAL' | 'PARTNER';

export type PlatformReferrerStatus = 'ACTIVE' | 'SUSPENDED';

export type TenantReferralSignupMethod = 'REF_LINK' | 'MANUAL_CODE' | 'PLATFORM_ASSIGNED';

export type PlatformReferrerCommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'REVERSED';

export const PLATFORM_REFERRER_TYPE_LABEL: Record<PlatformReferrerType, string> = {
  INDIVIDUAL: '개인',
  PARTNER: '파트너 업체',
};

export const PLATFORM_REFERRER_STATUS_LABEL: Record<PlatformReferrerStatus, string> = {
  ACTIVE: '활성',
  SUSPENDED: '중지',
};

export const PLATFORM_REFERRER_COMMISSION_STATUS_LABEL: Record<PlatformReferrerCommissionStatus, string> = {
  PENDING: '적립',
  APPROVED: '승인',
  PAID: '지급완료',
  REVERSED: '취소',
};

export function formatReferrerCommissionRateBps(bps: number): string {
  if (!Number.isFinite(bps)) return '—';
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/** 공유용 짧은 가입 경로 — `/r/{추천코드}` */
export const REFERRER_SIGNUP_SHORT_PATH = '/r';

export function buildReferrerSignupLinks(code: string, baseUrl = 'https://www.cbiseo.com') {
  const normalized = code.trim().toLowerCase();
  const encoded = encodeURIComponent(normalized);
  const origin = baseUrl.replace(/\/$/, '');
  return {
    shortLink: `${origin}${REFERRER_SIGNUP_SHORT_PATH}/${encoded}`,
    fullLink: `${origin}/signup?ref=${encoded}`,
  };
}
