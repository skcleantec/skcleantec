const API = '/api';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export interface InquiryChangeLogEntry {
  id: string;
  createdAt: string;
  lines: unknown;
}

export interface ScheduleItem {
  id: string;
  inquiryNumber?: string | null;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string | null;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  areaBasis?: string | null;
  propertyType?: string | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  kitchenCount?: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  /** 사이청소만: 오전/오후 확정. 미확정 null */
  betweenScheduleSlot?: string | null;
  preferredTimeDetail?: string | null;
  status: string;
  source?: string | null;
  memo?: string | null;
  /** 스케줄 목록 전용 짧은 메모(특이사항·발주서 메모와 별개) */
  scheduleMemo?: string | null;
  claimMemo?: string | null;
  callAttempt?: number | null;
  buildingType?: string | null;
  moveInDate?: string | null;
  specialNotes?: string | null;
  /** 전문 시공 옵션 id 배열(JSON) */
  professionalOptionIds?: unknown;
  /** 정산용(접수 건). 없으면 orderForm 금액으로 표시만 보조 */
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
  serviceBalanceAmount?: number | null;
  /** 현장 투입 팀원 수(관리자 입력) */
  crewMemberCount?: number | null;
  /** 팀원 수기(예: 김,태) */
  crewMemberNote?: string | null;
  orderForm?: {
    id: string;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    createdBy?: { id: string; name: string };
  } | null;
  assignments: Array<{ teamLeader: { id: string; name: string } }>;
  changeLogs?: InquiryChangeLogEntry[];
}

export async function getSchedule(
  token: string,
  start: string,
  end: string
): Promise<{ items: ScheduleItem[] }> {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(`${API}/schedule?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error('스케줄을 불러올 수 없습니다.');
  return res.json();
}

/** 관리자: 해당일 일정 마감(범위별 잔여 슬롯·TO 조정) */
export async function postScheduleDayClosure(
  token: string,
  date: string,
  scope: 'FULL' | 'MORNING' | 'AFTERNOON' = 'FULL'
): Promise<void> {
  const res = await fetch(`${API}/schedule/closures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date, scope }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '일정 마감 처리에 실패했습니다.');
  }
}

export async function deleteScheduleDayClosure(token: string, date: string): Promise<void> {
  const q = new URLSearchParams({ date }).toString();
  const res = await fetch(`${API}/schedule/closures?${q}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '일정 마감 해제에 실패했습니다.');
  }
}

export interface DayAvailabilityLeaderRow {
  id: string;
  name: string;
  hasUserDayOff: boolean;
  morningAvailable: boolean;
  afternoonAvailable: boolean;
  note: string | null;
  hasOverride: boolean;
}

export interface DayAvailabilityMemberRow {
  id: string;
  name: string;
  hasTeamMemberDayOff: boolean;
  available: boolean;
  note: string | null;
  hasOverride: boolean;
}

export interface DayAvailabilityResponse {
  date: string;
  closureScope: 'FULL' | 'MORNING' | 'AFTERNOON' | null;
  teamLeaders: DayAvailabilityLeaderRow[];
  teamMembers: DayAvailabilityMemberRow[];
  summary: {
    morningWorkingCount: number;
    afternoonWorkingCount: number;
    crewAvailable: number;
  };
}

export async function getDayAvailability(token: string, date: string): Promise<DayAvailabilityResponse> {
  const q = new URLSearchParams({ date }).toString();
  const res = await fetch(`${API}/schedule/day-availability?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '가용 인원을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function putDayAvailability(
  token: string,
  payload: {
    date: string;
    leaders: Array<{
      teamLeaderId: string;
      morningAvailable: boolean;
      afternoonAvailable: boolean;
      note?: string | null;
    }>;
    members: Array<{
      teamMemberId: string;
      available: boolean;
      note?: string | null;
    }>;
  }
): Promise<void> {
  const res = await fetch(`${API}/schedule/day-availability`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '가용 인원 저장에 실패했습니다.');
  }
}
