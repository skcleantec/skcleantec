import { API } from './apiPrefix';

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
  /** 크루 등 보조 표시명(태국어 등) */
  nameTh?: string | null;
  phone: string | null;
  sortOrder: number;
  isActive: boolean;
  /** yyyy-mm-dd — 입사일(포함) */
  hireDate?: string | null;
  /** yyyy-mm-dd — 퇴사일(미포함) */
  resignationDate?: string | null;
  /** 매월 급여 지급일(1~31). 미설정 시 null */
  monthlyPayDay?: number | null;
  /** 1일 급여·일당(원). 미설정 시 null — 월 급여표에서 근무일 수×일당 계산 */
  payAmountPerJob?: number | null;
  /** 설정된 급여 주기(월급일~다음 월급 전일) 안 접수 예약일 기준·메모 이름 매칭 청소 건수 */
  payCycleJobCount?: number | null;
  payCycleStartYmd?: string | null;
  payCycleEndYmd?: string | null;
  createdAt: string;
  dayOffCount: number;
  /** 고객 대면용 사원증 이미지 URL */
  staffIdCardUrl?: string | null;
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

/**
 * 접수 편집 중 예약일·팀장 기준, 각 팀원과 그 팀장이 마지막으로 같은 건으로 들어간 날부터 며칠 지났는지(표시만).
 */
export async function getCrewLeaderMemberSpacing(
  token: string,
  params: { teamLeaderId: string; preferredDate: string }
): Promise<{ spacingByMemberName: Record<string, number | null> }> {
  const q = new URLSearchParams({
    teamLeaderId: params.teamLeaderId.trim(),
    preferredDate: params.preferredDate.trim(),
  });
  const res = await fetch(`${API}/teams/crew-leader-member-spacing?${q}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀원 배정 간격 정보를 불러올 수 없습니다.');
  }
  return res.json();
}

export type GetPoolTeamMembersOptions = {
  /** true(기본): 급여주기 접수 집계 생략 — 목록·드롭다운용 빠른 응답 */
  lite?: boolean;
  /** active(기본) | resigned | all — 관리자 팀원 목록 */
  employmentStatus?: 'active' | 'resigned' | 'all';
};

export async function getPoolTeamMembers(
  token: string,
  preferredDate?: string | null,
  opts?: GetPoolTeamMembersOptions,
): Promise<{ items: TeamMemberItem[] }> {
  const params = new URLSearchParams();
  if (preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate.trim())) {
    params.set('preferredDate', preferredDate.trim());
  }
  if (opts?.lite !== false) {
    params.set('lite', '1');
  }
  if (opts?.employmentStatus) {
    params.set('employmentStatus', opts.employmentStatus);
  }
  const q = params.toString() ? `?${params.toString()}` : '';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(`${API}/teams/members${q}`, {
      headers: headers(token),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('팀원 목록 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
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
  data: { name: string; nameTh?: string | null; phone?: string | null; sortOrder?: number }
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
  data: {
    name?: string;
    nameTh?: string | null;
    phone?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    hireDate?: string | null;
    resignationDate?: string | null;
    monthlyPayDay?: number | null;
    payAmountPerJob?: number | null;
  }
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

/** 관리자: 현장 팀원 사원증 이미지 업로드 */
export async function uploadTeamMemberStaffIdCard(
  token: string,
  memberId: string,
  file: File
): Promise<{ staffIdCardUrl: string }> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`${API}/teams/members/${encodeURIComponent(memberId)}/staff-id-card`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '업로드에 실패했습니다.'));
  }
  const data = (await res.json().catch(() => null)) as { staffIdCardUrl?: string } | null;
  if (!data?.staffIdCardUrl) {
    throw new Error('업로드 응답이 올바르지 않습니다.');
  }
  return { staffIdCardUrl: data.staffIdCardUrl };
}

/** 관리자: 현장 팀원 사원증 이미지 삭제 */
export async function deleteTeamMemberStaffIdCard(token: string, memberId: string): Promise<void> {
  const res = await fetch(`${API}/teams/members/${encodeURIComponent(memberId)}/staff-id-card`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '삭제에 실패했습니다.'));
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
  data: {
    name?: string;
    phone?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    monthlyPayDay?: number | null;
    payAmountPerJob?: number | null;
  }
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

export interface TeamLeaderMonthlyStatRow {
  teamLeaderId: string;
  name: string;
  assigned: number;
  completed: number;
  incomplete: number;
  cancelled: number;
}

export async function getTeamLeaderMonthlyStats(
  token: string,
  month: string
): Promise<{ month: string; items: TeamLeaderMonthlyStatRow[] }> {
  const q = new URLSearchParams({ month });
  const res = await fetch(`${API}/teams/leader-monthly-stats?${q}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀장 실적을 불러올 수 없습니다.');
  }
  return res.json();
}
