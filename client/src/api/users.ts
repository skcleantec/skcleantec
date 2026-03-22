const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface TeamLeader {
  id: string;
  email: string;
  name: string;
  phone: string | null;
}

export async function getTeamLeaders(token: string): Promise<TeamLeader[]> {
  const res = await fetch(`${API}/users`, { headers: headers(token) });
  if (!res.ok) throw new Error('팀장 목록을 불러올 수 없습니다.');
  return res.json();
}

export async function createTeamLeader(
  token: string,
  data: { email: string; password: string; name: string; phone?: string }
): Promise<TeamLeader> {
  const res = await fetch(`${API}/users`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '등록에 실패했습니다.');
  }
  return res.json();
}
