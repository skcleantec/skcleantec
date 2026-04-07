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
  /** yyyy-mm-dd — 입사일(포함) */
  hireDate?: string | null;
  /** yyyy-mm-dd — 퇴사일(미포함) */
  resignationDate?: string | null;
}

/** @deprecated UserItem 사용 */
export type TeamLeader = UserItem;

export type GetUsersOptions = {
  /** 관리자 전용: 재직 필터 없이 전체 활성 목록 */
  scope?: 'management';
  /** 드롭다운용: 해당 KST 날짜에 재직 중인 사람만 (기본: 오늘) */
  employedOn?: string;
};

export async function getUsers(
  token: string,
  role: 'TEAM_LEADER' | 'MARKETER' = 'TEAM_LEADER',
  opts?: GetUsersOptions
): Promise<UserItem[]> {
  const params = new URLSearchParams({ role });
  if (opts?.scope === 'management') params.set('scope', 'management');
  if (opts?.employedOn) params.set('employedOn', opts.employedOn);
  const res = await fetch(`${API}/users?${params}`, { headers: headers(token) });
  if (!res.ok) throw new Error('목록을 불러올 수 없습니다.');
  return res.json();
}

/** @deprecated getUsers 사용 — 팀장 목록은 예약일 기준 재직자만 쓰려면 employedOn 전달 */
export async function getTeamLeaders(token: string, employedOn?: string): Promise<UserItem[]> {
  return getUsers(token, 'TEAM_LEADER', employedOn ? { employedOn } : undefined);
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

export async function updateUser(
  token: string,
  id: string,
  data: {
    email?: string;
    name?: string;
    phone?: string | null;
    /** 비우면 비밀번호는 그대로 둡니다. */
    password?: string;
    /** 최고 관리자만 — yyyy-mm-dd 또는 빈 문자열로 비움 */
    hireDate?: string | null;
    resignationDate?: string | null;
  }
): Promise<UserItem> {
  const res = await fetch(`${API}/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수정에 실패했습니다.');
  }
  return res.json();
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
