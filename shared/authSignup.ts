/** ADMIN SNS 가입 · 사업자 검증 — client (`@shared/authSignup`). 서버: `server/src/modules/auth-signup/signupBusiness.validation.ts` 와 동기화 */

export const SIGNUP_BUSINESS_TYPES = ['registered_business', 'individual'] as const;
export type SignupBusinessType = (typeof SIGNUP_BUSINESS_TYPES)[number];

export const AUTH_IDENTITY_PROVIDERS = ['google', 'kakao'] as const;
export type AuthIdentityProvider = (typeof AUTH_IDENTITY_PROVIDERS)[number];

export type SignupBusinessInput = {
  businessType: SignupBusinessType;
  bizNumber?: string | null;
  businessName?: string | null;
  representativeName?: string | null;
  addressLine?: string | null;
  businessRegistrationImageUrl?: string | null;
  businessRegistrationImagePublicId?: string | null;
  individualConfirmed?: boolean;
  individualUsageNote?: string | null;
};

const ADMIN_NAME_PLACEHOLDERS = new Set(['관리자', 'admin', 'administrator']);

export function normalizeSignupBusinessType(raw: unknown): SignupBusinessType | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'registered_business' || v === 'individual') return v;
  return null;
}

export function normalizeAuthIdentityProvider(raw: unknown): AuthIdentityProvider | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'google' || v === 'kakao') return v;
  return null;
}

/** 사업자등록번호 — 숫자 10자리 (하이픈 제거) */
export function normalizeBizNumber(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 10);
}

export function isValidBizNumber(raw: unknown): boolean {
  return normalizeBizNumber(raw).length === 10;
}

/** ADMIN 실명 — 로그인 아이디만으로 사람 구분 불가 (`docs/auth-signup/POLICY.md`) */
export function adminRealNameError(raw: unknown): string | null {
  const name = String(raw ?? '').trim();
  if (!name) return '관리자 실명을 입력해 주세요.';
  if (name.length < 2) return '실명은 2자 이상 입력해 주세요.';
  if (ADMIN_NAME_PLACEHOLDERS.has(name.toLowerCase())) {
    return '실명을 입력해 주세요. (「관리자」만 입력할 수 없습니다)';
  }
  return null;
}

export function validateSignupBusinessInput(input: SignupBusinessInput): string | null {
  const type = normalizeSignupBusinessType(input.businessType);
  if (!type) return '사업자 여부를 선택해 주세요.';

  if (type === 'individual') {
    if (!input.individualConfirmed) {
      return '사업자등록 없이 이용함을 확인해 주세요.';
    }
    return null;
  }

  if (!isValidBizNumber(input.bizNumber)) {
    return '사업자등록번호 10자리를 입력해 주세요.';
  }
  if (!String(input.businessName ?? '').trim()) {
    return '상호(사업자명)를 입력해 주세요.';
  }
  if (!String(input.representativeName ?? '').trim()) {
    return '대표자명을 입력해 주세요.';
  }
  const imageUrl = String(input.businessRegistrationImageUrl ?? '').trim();
  if (!imageUrl) {
    return '사업자등록증 이미지를 등록해 주세요.';
  }
  return null;
}
