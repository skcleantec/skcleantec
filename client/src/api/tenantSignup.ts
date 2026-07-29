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
  contactPhone?: string;
  memberTermsAgreed: boolean;
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

export async function submitTenantSignup(payload: TenantSignupPayload): Promise<TenantSignupResult> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as TenantSignupResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '가입에 실패했습니다.');
  return data;
}
