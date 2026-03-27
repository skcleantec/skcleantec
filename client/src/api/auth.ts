const API = '/api';

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. 프로젝트 루트에서 npm run dev 로 서버(3000)와 클라이언트(5173)를 함께 켜 주세요. (client만 단독 실행 시 로그인 불가)'
  );
}

export async function login(email: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw apiUnreachableMessage();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '로그인에 실패했습니다.');
  }
  return res.json();
}

export async function getMe(token: string) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('인증 정보를 불러올 수 없습니다.');
  return res.json();
}
