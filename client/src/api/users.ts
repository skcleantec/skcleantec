import { API } from './apiPrefix';

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
  externalCompanyId?: string | null;
  externalCompanyName?: string | null;
  /** yyyy-mm-dd — 입사일(포함) */
  hireDate?: string | null;
  /** yyyy-mm-dd — 퇴사일(미포함) */
  resignationDate?: string | null;
  /** 팀장만: 본인 휴무일 등록·삭제 허용(관리자 설정) */
  allowSelfDayOffEdit?: boolean;
  /** 팀장·마케터: 월 급여표용 고정 월급(원). 미설정 시 표에서 제외 또는 0 처리는 서버·화면 규칙 따름 */
  payrollMonthlySalary?: number | null;
  /** 팀장·마케터: 매월 급여 지급일(1–31). 미설정 시 월 급여표에서 말일 등 기본 규칙 */
  payrollPayDay?: number | null;
  /** 고객 대면용 사원증 이미지 URL (관리자 Cloudinary 업로드) */
  staffIdCardUrl?: string | null;
  /** 팀장만: 일반 정산 방식 */
  teamLeaderGeneralSettlementMode?: 'FIXED_PER_JOB_WON' | 'PERCENT_OF_GENERAL_SERVICE_BPS' | null;
  /** 팀장만: 건당 원 또는 일반 서비스 금액 대비 만분율(예 1500=15%) */
  teamLeaderGeneralSettlementValue?: number | null;
  /** 팀장만: 추가결재 정산 시 회사 몫 만분율(0~10000). null이면 운영 기본값으로 해석 가능 */
  teamLeaderAdditionalReceiptCompanyShareBps?: number | null;
}

export type TeamLeaderGeneralSettlementModeApi =
  | 'FIXED_PER_JOB_WON'
  | 'PERCENT_OF_GENERAL_SERVICE_BPS';

/** @deprecated UserItem 사용 */
export type TeamLeader = UserItem;

export type GetUsersOptions = {
  /** 관리자 전용: 재직 필터 없이 전체 활성 목록 */
  scope?: 'management';
  /** 드롭다운용: 해당 KST 날짜에 재직 중인 사람만 (기본: 오늘) */
  employedOn?: string;
};

export function formatAssignableUserLabel(u: UserItem): string {
  if (u.role === 'EXTERNAL_PARTNER') {
    return u.externalCompanyName
      ? `[타업체] ${u.externalCompanyName} (${u.name})`
      : `[타업체] ${u.name}`;
  }
  return u.name;
}

/** 스케줄·접수 분배 드롭다운: 팀장 + 타업체 담당 */
export async function getAssignableScheduleUsers(
  token: string,
  employedOn?: string
): Promise<UserItem[]> {
  const [leaders, partners] = await Promise.all([
    getUsers(token, 'TEAM_LEADER', employedOn ? { employedOn } : undefined),
    getUsers(token, 'EXTERNAL_PARTNER', employedOn ? { employedOn } : undefined),
  ]);
  const byName = (a: UserItem, b: UserItem) => a.name.localeCompare(b.name, 'ko');
  return [...leaders.sort(byName), ...partners.sort(byName)];
}

export async function getUsers(
  token: string,
  role: 'TEAM_LEADER' | 'MARKETER' | 'EXTERNAL_PARTNER' | 'ADMIN' = 'TEAM_LEADER',
  opts?: GetUsersOptions
): Promise<UserItem[]> {
  const params = new URLSearchParams({ role });
  if (opts?.scope === 'management') params.set('scope', 'management');
  if (opts?.employedOn) params.set('employedOn', opts.employedOn);
  const res = await fetch(`${API}/users?${params}`, { headers: headers(token) });
  if (!res.ok) throw new Error('목록을 불러올 수 없습니다.');
  return res.json();
}

/** 접수 등록자 선택용 — 활성 마케터 + 업무 관리자(ADMIN). 개발용 team-preview 계정은 서버에서 제외 */
export async function getInquiryCreatorOptions(token: string): Promise<UserItem[]> {
  const [marketers, admins] = await Promise.all([
    getUsers(token, 'MARKETER'),
    getUsers(token, 'ADMIN'),
  ]);
  const byName = (a: UserItem, b: UserItem) => a.name.localeCompare(b.name, 'ko');
  return [...marketers, ...admins].sort(byName);
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
    /** 등록 시 선택 — 마케터·팀장 월 급여표 반영 */
    payrollMonthlySalary?: number | null;
    payrollPayDay?: number | null;
    /** 팀장만 — 건당 정산·일반 서비스 비율 */
    teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementModeApi | null;
    teamLeaderGeneralSettlementValue?: number | null;
    teamLeaderAdditionalReceiptCompanyShareBps?: number | null;
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
    allowSelfDayOffEdit?: boolean;
    payrollMonthlySalary?: number | null;
    payrollPayDay?: number | null;
    teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementModeApi | null;
    teamLeaderGeneralSettlementValue?: number | null;
    teamLeaderAdditionalReceiptCompanyShareBps?: number | null;
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

/** 활성 팀장 전원의 본인 휴무일 등록 허용 일괄 설정 */
export async function bulkSetTeamLeaderAllowSelfDayOffEdit(
  token: string,
  enabled: boolean
): Promise<{ ok: boolean; updated: number }> {
  const res = await fetch(`${API}/users/team-leaders/day-off-self-edit`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '일괄 설정에 실패했습니다.');
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

/** 관리자: 팀장·마케터 사원증 이미지 업로드 */
export async function uploadUserStaffIdCard(
  token: string,
  userId: string,
  file: File
): Promise<{ staffIdCardUrl: string }> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`${API}/users/${encodeURIComponent(userId)}/staff-id-card`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `업로드에 실패했습니다. (HTTP ${res.status})`);
  }
  const data = (await res.json().catch(() => null)) as { staffIdCardUrl?: string } | null;
  if (!data?.staffIdCardUrl) {
    throw new Error('업로드 응답이 올바르지 않습니다.');
  }
  return { staffIdCardUrl: data.staffIdCardUrl };
}

/** 관리자: 팀장·마케터 사원증 이미지 삭제 */
export async function deleteUserStaffIdCard(token: string, userId: string): Promise<void> {
  const res = await fetch(`${API}/users/${encodeURIComponent(userId)}/staff-id-card`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || '삭제에 실패했습니다.');
  }
}
