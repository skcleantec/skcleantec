/** 테넌트 업무 로그인 아이디 — DB `User.email` 컬럼에 저장, 이메일 형식 아님 */

export const TENANT_LOGIN_ID_RE = /^[a-z0-9](?:[a-z0-9_-]{0,46}[a-z0-9])?$/;

export function normalizeTenantLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidTenantLoginId(loginId: string): boolean {
  if (!loginId || loginId.includes('@')) return false;
  return TENANT_LOGIN_ID_RE.test(loginId);
}

export function tenantLoginIdErrorMessage(): string {
  return '아이디는 영문 소문자·숫자·_(밑줄)·-(하이픈) 2~48자만 사용할 수 있습니다. 이메일 형식은 사용하지 않습니다.';
}

export function assertValidTenantLoginId(raw: string): string {
  const loginId = normalizeTenantLoginId(raw);
  if (!isValidTenantLoginId(loginId)) {
    throw new Error(tenantLoginIdErrorMessage());
  }
  return loginId;
}
