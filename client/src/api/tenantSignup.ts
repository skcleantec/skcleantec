import type { SignupBusinessInput } from '@shared/authSignup';

const API = '/api/public/tenant-signup';

export type TenantSlugAvailability = {
  available: boolean;
  slug: string;
  reason?: string;
};

export type TenantSignupPayload = {
  slug: string;
  name: string;
  adminLoginId: string;
  adminPassword: string;
  adminName?: string;
  contactEmail: string;
  contactPhone: string;
  memberTermsAgreed: boolean;
  selectedPlan: string;
  referrerCode?: string;
  referrerFromLink?: boolean;
  /** Phase 4 — Google verify 후 15분 유효 signupToken */
  signupToken?: string;
};

export type TenantReferrerValidation = {
  valid: boolean;
  code?: string;
  displayName?: string;
  reason?: string;
};

export type TenantSignupVerificationSent = {
  challengeId: string;
  expiresAt: string;
  message: string;
};

export type TenantSignupResult = {
  tenant: { id: string; slug: string; name: string; plan: string; status: string };
  admin: { loginId: string; name: string };
  message: string;
};

export async function checkTenantSignupSlug(slug: string): Promise<TenantSlugAvailability> {
  const q = new URLSearchParams({ slug });
  const res = await fetch(`${API}/slug-available?${q}`);
  const data = (await res.json()) as TenantSlugAvailability & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '업체 코드 확인에 실패했습니다.');
  return data;
}

export async function validateTenantSignupReferrer(code: string): Promise<TenantReferrerValidation> {
  const q = new URLSearchParams({ code });
  const res = await fetch(`${API}/validate-referrer?${q}`);
  const data = (await res.json()) as TenantReferrerValidation & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '추천인 코드 확인에 실패했습니다.');
  return data;
}

export async function sendTenantSignupVerificationCode(
  payload: TenantSignupPayload,
): Promise<TenantSignupVerificationSent> {
  const res = await fetch(`${API}/send-verification-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as TenantSignupVerificationSent & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '인증번호 발송에 실패했습니다.');
  return data;
}

export type TenantSignupBusinessUpload = {
  businessRegistrationImageUrl: string;
  businessRegistrationImagePublicId: string;
};

export async function uploadTenantSignupBusinessRegistration(
  file: File,
): Promise<TenantSignupBusinessUpload> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API}/upload-business-registration`, {
    method: 'POST',
    body: fd,
  });
  const data = (await res.json()) as TenantSignupBusinessUpload & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '사업자등록증 업로드에 실패했습니다.');
  return data;
}

export async function completeTenantSignup(input: {
  challengeId: string;
  contactEmail: string;
  verificationCode: string;
  memberTermsAgreed: boolean;
} & SignupBusinessInput): Promise<TenantSignupResult> {
  const res = await fetch(`${API}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as TenantSignupResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '가입에 실패했습니다.');
  return data;
}
