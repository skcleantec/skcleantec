import { normalizeAlimtalkPhone } from './alimtalkPhone.js';

/** 스테이징 실발송 허용 번호 (하이픈 없이 정규화 후 비교) */
export const ALIMTALK_STAGING_TEST_PHONE = '01086848692';

export function isAlimtalkStagingEnvironment(): boolean {
  const railway = (process.env.RAILWAY_ENVIRONMENT ?? '').trim().toLowerCase();
  if (railway === 'staging') return true;
  if (railway === 'production') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * 스테이징(및 로컬)에서는 시험 번호로만 실제 발송.
 * 운영에서는 제한하지 않음(실고객 발송 허용 — 테스트 발송은 수동으로 하지 말 것).
 */
export function assertAlimtalkRecipientAllowed(toPhone: string): string | null {
  if (!isAlimtalkStagingEnvironment()) return null;
  const normalized = normalizeAlimtalkPhone(toPhone);
  const allowed = normalizeAlimtalkPhone(ALIMTALK_STAGING_TEST_PHONE);
  if (normalized && allowed && normalized === allowed) return null;
  return `스테이징에서는 시험 번호(${ALIMTALK_STAGING_TEST_PHONE})로만 알림톡을 보낼 수 있습니다.`;
}
