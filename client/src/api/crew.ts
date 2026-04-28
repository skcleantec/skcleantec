import { API, apiErrorMessage } from './apiPrefix';
import { isLikelyNetworkFailure } from './fetchNetwork';
import { AuthSessionExpiredError } from './auth';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. 루트에서 npm run dev 로 API와 Vite를 함께 켜 주세요.'
  );
}

export async function loginCrew(loginId: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/crew-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password }),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const msg = typeof data.error === 'string' && data.error.trim() ? data.error.trim() : null;
    throw new Error(msg ?? `로그인에 실패했습니다. (HTTP ${res.status})`);
  }
  return res.json() as Promise<{
    token: string;
    crewGroup: { id: string; name: string; crewViewerRole: 'LEADER' | 'MEMBER' };
  }>;
}

/** 관리자 미리보기 전용 — 비밀번호 없이 크루 JWT (서버에서 ADMIN·MARKETER만 허용) */
export async function crewDevPreviewLogin(adminToken: string, loginId: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/crew-dev-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ loginId }),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const msg = typeof data.error === 'string' && data.error.trim() ? data.error.trim() : null;
    throw new Error(msg ?? `크루 미리보기에 실패했습니다. (HTTP ${res.status})`);
  }
  return res.json() as Promise<{
    token: string;
    crewGroup: { id: string; name: string; crewViewerRole: 'LEADER' | 'MEMBER' };
  }>;
}

export interface CrewMeResponse {
  role: string;
  crewGroupId: string;
  crewViewerRole: 'LEADER' | 'MEMBER';
  group: {
    id: string;
    name: string;
    loginId: string;
    phone: string | null;
    useDailyRosterOnly: boolean;
    hasSettingsPassword: boolean;
    members: Array<{
      teamMemberId: string;
      name: string;
      nameTh?: string | null;
      phone: string | null;
      isActive: boolean;
      isGroupLeader: boolean;
    }>;
  };
}

export async function getCrewMe(token: string): Promise<CrewMeResponse> {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/crew-me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '세션을 확인할 수 없습니다.'));
  }
  return res.json();
}

export async function patchCrewMemberDisplayNames(
  token: string,
  updates: { teamMemberId: string; nameTh: string | null }[],
): Promise<void> {
  const res = await fetch(`${API}/crew/members/display-names`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ updates }),
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '표시 이름을 저장할 수 없습니다.'));
  }
}

export async function patchCrewMemberPhone(
  token: string,
  teamMemberId: string,
  phone: string | null,
): Promise<void> {
  const res = await fetch(`${API}/crew/members/${encodeURIComponent(teamMemberId)}/phone`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ phone }),
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '연락처를 저장할 수 없습니다.'));
  }
}

export interface DayRosterItem {
  date: string;
  teamMemberIds: string[];
}

export async function getCrewDayRoster(token: string, start: string, end: string) {
  const q = new URLSearchParams({ start, end });
  const res = await fetch(`${API}/crew/day-roster?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '일자 명단을 불러올 수 없습니다.'));
  }
  return res.json() as Promise<{ crewGroupId: string; start: string; end: string; items: DayRosterItem[] }>;
}

export async function putCrewDayRoster(
  token: string,
  entries: DayRosterItem[],
  options?: { settingsPassword?: string }
): Promise<void> {
  const res = await fetch(`${API}/crew/day-roster`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({
      entries,
      ...(options?.settingsPassword != null && String(options.settingsPassword).trim()
        ? { settingsPassword: String(options.settingsPassword).trim() }
        : {}),
    }),
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '일자 명단을 저장할 수 없습니다.'));
  }
}

export interface CrewFieldLeader {
  id: string;
  name: string;
  /** 팀장 프로필 로마자 이름 — 크루 현장 일정 배정 열 옆 표시 */
  nameEn?: string | null;
  role: string;
  vehicleNumber: string | null;
  externalCompanyName: string | null;
}

export interface CrewFieldInquiry {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  address: string;
  preferredTime: string | null;
  /** 팀장 지정 현장 미팅(HH:mm KST). 오전 희망 접수 등에서만 채워짐 */
  crewMeetingTime?: string | null;
  /** 팀장이 미팅 시각 저장·변경 후 true — 시간 옆 «수정됨»(태국어) 배지 */
  crewMeetingTimeEdited?: boolean;
  status: string;
  leaders: CrewFieldLeader[];
}

export interface CrewFieldMemberDay {
  teamMemberId: string;
  name: string;
  nameTh?: string | null;
  onRoster: boolean;
  inquiries: CrewFieldInquiry[];
}

export interface CrewFieldDay {
  date: string;
  members: CrewFieldMemberDay[];
}

export interface CrewMonthlyJobStatItem {
  teamMemberId: string;
  name: string;
  nameTh: string | null;
  isActive: boolean;
  inquiryCount: number;
}

export async function getCrewMonthlyJobStats(token: string, month?: string) {
  const q = new URLSearchParams();
  if (month && /^\d{4}-\d{2}$/.test(month)) q.set('month', month);
  const res = await fetch(`${API}/crew/monthly-job-stats?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '월별 실적을 불러올 수 없습니다.'));
  }
  return res.json() as Promise<{
    month: string;
    useDailyRosterOnly: boolean;
    items: CrewMonthlyJobStatItem[];
  }>;
}

export async function getCrewFieldSchedule(token: string, start: string, end: string) {
  const q = new URLSearchParams({ start, end });
  const res = await fetch(`${API}/crew/field-schedule?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '일정 정보를 불러올 수 없습니다.'));
  }
  return res.json() as Promise<{
    crewGroupId: string;
    start: string;
    end: string;
    useDailyRosterOnly: boolean;
    days: CrewFieldDay[];
  }>;
}
