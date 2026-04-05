const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface TeamLeaderBrief {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
}

export interface TeamMemberItem {
  id: string;
  name: string;
  phone: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  dayOffCount: number;
}

export interface TeamItem {
  id: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  teamLeader: TeamLeaderBrief;
  members: TeamMemberItem[];
}

export async function getTeams(token: string): Promise<{ items: TeamItem[] }> {
  const res = await fetch(`${API}/teams`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

/** 팀장 소속 없이 등록한 전사 팀원 풀 (teamId 없음) */
export async function getPoolTeamMembers(token: string): Promise<{ items: TeamMemberItem[] }> {
  const res = await fetch(`${API}/teams/members`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀 미배정 팀원 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* not JSON */
  }
  if (text && text.length < 200) return text;
  return `${fallback} (HTTP ${res.status})`;
}

export async function addPoolTeamMember(
  token: string,
  data: { name: string; phone?: string | null; sortOrder?: number }
): Promise<void> {
  const res = await fetch(`${API}/teams/members`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '팀원 등록에 실패했습니다.'));
  }
}

export async function updatePoolTeamMember(
  token: string,
  memberId: string,
  data: { name?: string; phone?: string | null; sortOrder?: number; isActive?: boolean }
): Promise<void> {
  const res = await fetch(`${API}/teams/members/${memberId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수정에 실패했습니다.');
  }
}

export async function deletePoolTeamMember(token: string, memberId: string, password: string): Promise<void> {
  const res = await fetch(`${API}/teams/members/${memberId}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제에 실패했습니다.');
  }
}

export async function getPoolMemberDayOffs(
  token: string,
  memberId: string,
  start: string,
  end: string
): Promise<{ items: string[] }> {
  const q = new URLSearchParams({ start, end });
  const res = await fetch(`${API}/teams/members/${memberId}/day-offs?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '휴무 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function addPoolMemberDayOff(token: string, memberId: string, date: string): Promise<void> {
  const res = await fetch(`${API}/teams/members/${memberId}/day-offs`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '휴무 등록에 실패했습니다.');
  }
}

export async function removePoolMemberDayOff(token: string, memberId: string, date: string): Promise<void> {
  const q = new URLSearchParams({ date });
  const res = await fetch(`${API}/teams/members/${memberId}/day-offs?${q}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '휴무 해제에 실패했습니다.');
  }
}

export async function createTeam(
  token: string,
  data: { teamLeaderId: string; memo?: string | null }
): Promise<{ id: string; memo: string | null; teamLeader: TeamLeaderBrief; members: TeamMemberItem[] }> {
  const res = await fetch(`${API}/teams`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀을 만들 수 없습니다.');
  }
  return res.json();
}

export async function updateTeamMemo(token: string, teamId: string, memo: string | null): Promise<void> {
  const res = await fetch(`${API}/teams/${teamId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ memo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '저장에 실패했습니다.');
  }
}

export async function deleteTeam(token: string, teamId: string, password: string): Promise<void> {
  const res = await fetch(`${API}/teams/${teamId}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제에 실패했습니다.');
  }
}

export async function addTeamMember(
  token: string,
  teamId: string,
  data: { name: string; phone?: string | null; sortOrder?: number }
): Promise<void> {
  const res = await fetch(`${API}/teams/${teamId}/members`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀원 등록에 실패했습니다.');
  }
}

export async function updateTeamMember(
  token: string,
  teamId: string,
  memberId: string,
  data: { name?: string; phone?: string | null; sortOrder?: number; isActive?: boolean }
): Promise<void> {
  const res = await fetch(`${API}/teams/${teamId}/members/${memberId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수정에 실패했습니다.');
  }
}

export async function deleteTeamMember(
  token: string,
  teamId: string,
  memberId: string,
  password: string
): Promise<void> {
  const res = await fetch(`${API}/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제에 실패했습니다.');
  }
}

export async function getMemberDayOffs(
  token: string,
  teamId: string,
  memberId: string,
  start: string,
  end: string
): Promise<{ items: string[] }> {
  const q = new URLSearchParams({ start, end });
  const res = await fetch(`${API}/teams/${teamId}/members/${memberId}/day-offs?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '휴무 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function addMemberDayOff(token: string, teamId: string, memberId: string, date: string): Promise<void> {
  const res = await fetch(`${API}/teams/${teamId}/members/${memberId}/day-offs`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '휴무 등록에 실패했습니다.');
  }
}

export async function removeMemberDayOff(
  token: string,
  teamId: string,
  memberId: string,
  date: string
): Promise<void> {
  const q = new URLSearchParams({ date });
  const res = await fetch(`${API}/teams/${teamId}/members/${memberId}/day-offs?${q}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '휴무 해제에 실패했습니다.');
  }
}
