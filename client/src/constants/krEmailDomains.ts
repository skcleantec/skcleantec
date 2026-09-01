/**
 * 고객 발주서 이메일 — 국내에서 많이 쓰는 도메인 (앱·포털 이용 순).
 * 마지막은 UI에서 「직접 작성」.
 */
export const KR_EMAIL_DOMAINS = [
  'naver.com',
  'gmail.com',
  'daum.net',
  'hanmail.net',
  'nate.com',
  'kakao.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
] as const;

export const EMAIL_DOMAIN_CUSTOM = '__custom__';

export type KrEmailDomain = (typeof KR_EMAIL_DOMAINS)[number];
