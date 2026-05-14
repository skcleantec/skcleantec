import { randomBytes } from 'crypto';

/** 공개 체결 링크용 토큰(추측 어려움). */
export function newEContractInviteToken(): string {
  return randomBytes(32).toString('base64url');
}
