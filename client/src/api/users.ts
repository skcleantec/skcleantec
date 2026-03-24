const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface UserItem {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role?: string;
}

/** @deprecated UserItem 사용 */
export type TeamLeader = UserItem;

export async function getUsers(
  token: string,
  role: 'TEAM_LEADER' | 'MARKETER' = 'TEAM_LEADER'
): Promise<UserItem[]> {
  const res = await fetch(`${API}/users?role=${role}`, { headers: headers(token) });
  if (!res.ok) throw new Error('목록을 불러올 수 없습니다.');
  return res.json();
}

/** @deprecated getUsers 사용 */
export async function getTeamLeaders(token: string): Promise<UserItem[]> {
  return getUsers(token, 'TEAM_LEADER');
}

export async function createUser(
  token: string,
  data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: 'TEAM_LEADER' | 'MARKETER';
  }
): Promise<UserItem> {
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

/** @deprecated createUser 사용 */
export async function createTeamLeader(
  token: string,
  data: { email: string; password: string; name: string; phone?: string }
): Promise<UserItem> {
  return createUser(token, { ...data, role: 'TEAM_LEADER' });
}

export async function deleteUser(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제에 실패했습니다.');
  }
}
