const API = '/api';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export type TenantSupportAccessRow = {
  id: string;
  loginId: string;
  name: string;
  memo: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function suggestTenantSupportAccess(token: string) {
  const res = await fetch(`${API}/platform/support-access/suggest`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('추천 아이디 생성에 실패했습니다.');
  return res.json() as Promise<{ loginId: string; password: string }>;
}

export async function listTenantSupportAccess(token: string) {
  const res = await fetch(`${API}/platform/support-access`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('지원 접속 계정 목록 조회에 실패했습니다.');
  const data = (await res.json()) as { items: TenantSupportAccessRow[] };
  return data.items;
}

export async function createTenantSupportAccess(
  token: string,
  body: { loginId: string; password: string; name?: string; memo?: string },
) {
  const res = await fetch(`${API}/platform/support-access`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    account?: TenantSupportAccessRow;
    initialPassword?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? '계정 생성에 실패했습니다.');
  return data as { account: TenantSupportAccessRow; initialPassword: string };
}

export async function patchTenantSupportAccess(
  token: string,
  id: string,
  body: {
    loginId?: string;
    password?: string;
    name?: string;
    memo?: string | null;
    isActive?: boolean;
  },
) {
  const res = await fetch(`${API}/platform/support-access/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { account?: TenantSupportAccessRow; error?: string };
  if (!res.ok) throw new Error(data.error ?? '계정 수정에 실패했습니다.');
  return data.account!;
}
