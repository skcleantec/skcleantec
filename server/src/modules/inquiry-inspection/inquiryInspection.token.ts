import { randomBytes } from 'crypto';

/** 검수 완료본 고객 열람 공개 링크 토큰 */
export function generateInspectionCustomerViewToken(): string {
  return randomBytes(16).toString('hex');
}
