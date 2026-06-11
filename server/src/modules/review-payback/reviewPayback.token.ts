import { randomBytes } from 'crypto';

/** 발주서 token 과 분리된 페이백 공개 링크 토큰 */
export function generateReviewPaybackToken(): string {
  return randomBytes(12).toString('hex');
}
