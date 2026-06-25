import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
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

export interface TeamCrewGroupMemberRow {
  id: string;
  teamMemberId: string;
  name: string;
  nameTh?: string | null;
  phone: string | null;
  isActive: boolean;
  isGroupLeader: boolean;
}

export interface TeamCrewGroupItem {
  id: string;
  name: string;
  loginId: string;
  phone: string | null;
  useDailyRosterOnly: boolean;
  hasSettingsPassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members: TeamCrewGroupMemberRow[];
}

export async function getTeamCrewGroups(token: string): Promise<{ items: TeamCrewGroupItem[] }> {
  const res = await fetch(`${API}/team-crew-groups`, { headers: headers(token) });
  if (!res.ok) {
    throw new Error(await readApiError(res, '크루 그룹 목록을 불러올 수 없습니다.'));
  }
  return res.json();
}

export async function createTeamCrewGroup(
  token: string,
  body: {
    name: string;
    loginId: string;
    password: string;
    phone?: string | null;
    useDailyRosterOnly?: boolean;
    settingsPassword?: string | null;
    adminPassword: string;
  }
): Promise<TeamCrewGroupItem> {
  const res = await fetch(`${API}/team-crew-groups`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '그룹을 만들 수 없습니다.'));
  }
  return res.json();
}

export async function updateTeamCrewGroup(
  token: string,
  groupId: string,
  body: {
    name?: string;
    phone?: string | null;
    loginId?: string;
    useDailyRosterOnly?: boolean;
    isActive?: boolean;
    password?: string | null;
    settingsPassword?: string | null;
    clearSettingsPassword?: boolean;
    adminPassword?: string;
  }
): Promise<TeamCrewGroupItem> {
  const res = await fetch(`${API}/team-crew-groups/${groupId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '그룹을 저장할 수 없습니다.'));
  }
  return res.json();
}

export async function deleteTeamCrewGroup(token: string, groupId: string, password: string): Promise<void> {
  const res = await fetch(`${API}/team-crew-groups/${groupId}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '그룹을 삭제할 수 없습니다.'));
  }
}

export async function addTeamCrewGroupMember(
  token: string,
  groupId: string,
  teamMemberId: string
): Promise<TeamCrewGroupMemberRow> {
  const res = await fetch(`${API}/team-crew-groups/${groupId}/members`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ teamMemberId }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '멤버를 추가할 수 없습니다.'));
  }
  return res.json();
}

export async function removeTeamCrewGroupMember(
  token: string,
  groupId: string,
  teamMemberId: string
): Promise<void> {
  const res = await fetch(`${API}/team-crew-groups/${groupId}/members/${teamMemberId}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '멤버를 제거할 수 없습니다.'));
  }
}

export async function setTeamCrewGroupMemberLeader(
  token: string,
  groupId: string,
  teamMemberId: string,
  isGroupLeader: boolean
): Promise<TeamCrewGroupMemberRow> {
  const res = await fetch(`${API}/team-crew-groups/${groupId}/members/${teamMemberId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ isGroupLeader }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '그룹장 설정을 저장할 수 없습니다.'));
  }
  return res.json();
}

export interface DayRosterMemberItem {
  teamMemberId: string;
  isStandby: boolean;
}

export interface DayRosterItem {
  date: string;
  members?: DayRosterMemberItem[];
  teamMemberIds?: string[];
  standbyTeamMemberIds?: string[];
}

export async function getTeamCrewGroupDayRoster(
  token: string,
  groupId: string,
  start: string,
  end: string
): Promise<{ items: DayRosterItem[] }> {
  const q = new URLSearchParams({ start, end });
  const res = await fetch(`${API}/team-crew-groups/${groupId}/day-roster?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '일자 명단을 불러올 수 없습니다.'));
  }
  const data = (await res.json()) as { items: DayRosterItem[] };
  return { items: data.items ?? [] };
}

export async function putTeamCrewGroupDayRoster(
  token: string,
  groupId: string,
  entries: DayRosterItem[]
): Promise<void> {
  const res = await fetch(`${API}/team-crew-groups/${groupId}/day-roster`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '일자 명단을 저장할 수 없습니다.'));
  }
}
