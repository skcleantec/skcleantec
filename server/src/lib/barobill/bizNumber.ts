/**
 * shared/authSignup.ts isValidKoreanBizNumberChecksum 과 같은 식.
 * 서버 tsconfig rootDir 때문에 shared 를 직접 import 하지 않는다.
 */
export function normalizeBizDigits(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 10);
}

export function isValidKoreanBizNumberChecksum(raw: unknown): boolean {
  const digits = normalizeBizDigits(raw);
  if (digits.length !== 10) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * weights[i];
  sum += Math.floor((Number(digits[8]) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[9]);
}

export function cashbillRegistrationFolder(tenantId: string, operatingCompanyId: string): string {
  return `cbiseo/cashbill-business-registration/${tenantId}/${operatingCompanyId}`;
}
