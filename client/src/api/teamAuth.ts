const API = '/api';

export async function teamLogin(email: string, password: string) {
  const res = await fetch(`${API}/auth/team-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '로그인에 실패했습니다.');
  }
  return res.json();
}
