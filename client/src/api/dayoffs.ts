import { API } from './apiPrefix';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getMyDayOffs(
  token: string,
  start: string,
  end: string
): Promise<{ items: string[] }> {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(withTeamPreviewQuery(`${API}/dayoffs/me?${q}`), { headers: headers(token) });
  if (!res.ok) throw new Error('휴무일을 불러올 수 없습니다.');
  return res.json();
}

export async function addDayOff(token: string, date: string): Promise<void> {
  const res = await fetch(withTeamPreviewQuery(`${API}/dayoffs/me`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '휴무일 추가에 실패했습니다.');
  }
}

export async function removeDayOff(token: string, date: string): Promise<void> {
  const q = new URLSearchParams({ date }).toString();
  const res = await fetch(withTeamPreviewQuery(`${API}/dayoffs/me?${q}`), {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '휴무일 삭제에 실패했습니다.');
  }
}

export interface ScheduleStatsByDate {
  offCount: number;
  offNames: string[];
  workingCount: number;
  totalTeamLeaders: number;
  assignedCount: number;
  availableNames: string[];
  availableMorningNames?: string[];
  availableAfternoonNames?: string[];
  /** 오전·오후 슬롯 근무 가능 팀장 전원 이름(표시용) */
  morningWorkingNames?: string[];
  afternoonWorkingNames?: string[];
  /** 해당일 오전 슬롯에 배정 가능한 팀장 id (스케줄 상세 담당자 선택용) */
  availableMorningLeaderIds?: string[];
  /** 해당일 오후 슬롯에 배정 가능한 팀장 id */
  availableAfternoonLeaderIds?: string[];
  /** 오전 슬롯 소진 건수 */
  morningOccupied?: number;
  /** 오후 슬롯 소진 건수 */
  afternoonOccupied?: number;
  /** 사이청소 옵션 접수 건수(해당일) */
  sideCleaningOrderCount?: number;
  /** 사이청소 중 오전/오후 미확정 건수 */
  sideCleaningUnconfirmedCount?: number;
  /** 남은 슬롯 합: 오전+오후 (휴무 반영) */
  unassignedTotal?: number;
  assignableMorning?: number;
  assignableAfternoonSlot?: number;
  /** 관리자 수동 일정마감 적용 여부(전체 마감 등 레거시·FULL과 함께 사용) */
  manualClosed?: boolean;
  /** 일정 마감 범위: 전체 / 오전만 / 오후만 */
  closureScope?: 'FULL' | 'MORNING' | 'AFTERNOON';
  /** 휴무·수동슬롯 반영 오전·오후 근무 가능 팀장 수 */
  morningWorkingCount?: number;
  afternoonWorkingCount?: number;
  /** 당일 휴무 제외 활성 팀원 수 */
  crewAvailable?: number;
  /** 당일 휴무인 활성 팀원 수 */
  crewDayOffCount?: number;
  /** 해당일 접수 팀원 투입 단위 합 */
  crewDemand?: number;
  /** 팀원 투입 잔여(명) */
  crewRemaining?: number;
  /** 팀원 잔여 기준 표준(2명) 접수 추가 가능 건수(참고) */
  additionalStandardJobsByCrew?: number;
  /** 표시 보정 적용 전 오전 잔여 슬롯(계산·마감 반영) */
  computedAssignableMorning?: number;
  computedAssignableAfternoonSlot?: number;
  /** 오전 TO 표시 가산 보정 */
  slotToMorningAdjustment?: number;
  /** 오후 TO 표시 가산 보정 */
  slotToAfternoonAdjustment?: number;
}

export type AsCsScheduleListItem = {
  id: string;
  customerName: string;
  customerPhone: string;
  content: string;
  status: string;
  inquiryId: string | null;
  inquiryNumber: string | null;
};

export async function getScheduleStats(
  token: string,
  start: string,
  end: string
): Promise<{ byDate: Record<string, ScheduleStatsByDate>; asCsByDate: Record<string, AsCsScheduleListItem[]> }> {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(withTeamPreviewQuery(`${API}/dayoffs/schedule-stats?${q}`), {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('스케줄 현황을 불러올 수 없습니다.');
  const json = (await res.json()) as {
    byDate?: Record<string, ScheduleStatsByDate>;
    asCsByDate?: Record<string, AsCsScheduleListItem[]>;
  };
  return {
    byDate: json.byDate ?? {},
    asCsByDate: json.asCsByDate ?? {},
  };
}

export async function putScheduleSlotToAdjustment(
  token: string,
  payload: { date: string; morningDelta: number; afternoonDelta: number }
): Promise<void> {
  const res = await fetch(withTeamPreviewQuery(`${API}/dayoffs/schedule-slot-to-adjustment`), {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '인원(TO) 표시 보정 저장에 실패했습니다.');
  }
}

export interface TeamCalendarDayEntry {
  teamLeaderOffs: { id: string; name: string }[];
  teamMemberOffs: { id: string; name: string }[];
}

/** 팀장별: 해당 월 휴무일·등록 시각(ISO), 미등록 팀장 목록 */
export interface TeamLeaderMonthOffEntry {
  date: string;
  registeredAt: string;
}

export interface TeamLeaderMonthWithOffs {
  id: string;
  name: string;
  totalDays: number;
  entries: TeamLeaderMonthOffEntry[];
}

export async function getTeamHolidayCalendar(
  token: string,
  start: string,
  end: string
): Promise<{
  byDate: Record<string, TeamCalendarDayEntry>;
  teamLeaderMonth?: {
    withOffs: TeamLeaderMonthWithOffs[];
    noOffThisMonth: { id: string; name: string }[];
  };
}> {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(withTeamPreviewQuery(`${API}/dayoffs/team-calendar?${q}`), {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('휴일 캘린더를 불러올 수 없습니다.');
  return res.json();
}
