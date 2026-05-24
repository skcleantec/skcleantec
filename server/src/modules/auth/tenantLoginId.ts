/**
 * 테넌트 업무 로그인 아이디 검증 — shared/tenantLoginId.ts 와 동기화
 * (DB `User.email` 컬럼에 저장, 이메일 형식 아님)
 */

const LOGIN_ID_RE = /^[a-z0-9](?:[a-z0-9_-]{0,46}[a-z0-9])?$/;

export function normalizeTenantLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertValidTenantLoginId(raw: string): string {
  const loginId = normalizeTenantLoginId(raw);
  if (!loginId || loginId.includes('@') || !LOGIN_ID_RE.test(loginId)) {
    throw new Error(
      '아이디는 영문 소문자·숫자·_(밑줄)·-(하이픈) 2~48자만 사용할 수 있습니다. 이메일 형식은 사용하지 않습니다.',
    );
  }
  return loginId;
}
