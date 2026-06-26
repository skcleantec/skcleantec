import crypto from 'crypto';
import { config } from '../../config/index.js';

/** 토큰·서버 시크릿만으로 일관된 6자리 본인확인 번호 생성(별도 칼럼 불필요). */
export function deriveChallengeDigitsForToken(rawToken: string): string {
  const h = crypto
    .createHash('sha256')
    .update(`e_contract_challenge_v1|${config.jwtSecret}|${rawToken.trim()}`, 'utf8')
    .digest('hex');
  const n = (BigInt('0x' + h.slice(0, 14)) % 900000n) + 100000n;
  return String(n).padStart(6, '0');
}

export function challengeDigitsFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = (payload as Record<string, unknown>).challengeDigits;
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\s/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** 체결 payload 우선, 없으면 발급 링크 토큰으로 복원(레거시 제출본). */
export function resolveSubmissionChallengeDigits(payload: unknown, inviteToken: string): string {
  return challengeDigitsFromPayload(payload) ?? deriveChallengeDigitsForToken(inviteToken);
}
