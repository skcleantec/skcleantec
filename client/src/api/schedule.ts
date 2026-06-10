import { API } from './apiPrefix';
import type { TenantInquiryShareMeta } from './tenantInquiryShare';

export type { TenantInquiryShareMeta };

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export interface InquiryChangeLogEntry {
  id: string;
  createdAt: string;
  lines: unknown;
  actorId?: string | null;
  /** PATCH 저장 시 로그인한 관리자·마케터 */
  actor?: { id: string; name: string } | null;
}

export interface ScheduleItem {
  id: string;
  inquiryNumber?: string | null;
  customerName: string;
  nickname?: string | null;
  customerPhone: string;
  customerPhone2?: string | null;
  address: string;
  addressDetail: string | null;
  /** 서버·상세 동기화 시 저장된 지오코딩 캐시(스케줄 맵 등에서 재사용) */
  addressGeoLat?: number | null;
  addressGeoLng?: number | null;
  addressGeoQuery?: string | null;
  areaPyeong: number | null;
  areaBasis?: string | null;
  /** 전용면적 기준 시 참고 제곱미터 */
  exclusiveAreaSqm?: number | null;
  propertyType?: string | null;
  isOneRoom?: boolean | null;
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
  /** 상담·참고용 마케터 메모 — 팀장·타업체와 공유 */
  consultationMemo?: string | null;
  /** 내부 고객 등급 — 마케터·관리자 API만 */
  internalCustomerTone?: 'GOOD' | 'NORMAL' | 'BAD' | null;
  claimMemo?: string | null;
  callAttempt?: number | null;
  buildingType?: string | null;
  moveInDate?: string | null;
  moveInDateUndecided?: boolean;
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
  /** 타업체 담당 시 받는 수수료(원) */
  externalTransferFee?: number | null;
  /** 팀장 해피콜 완료 시각 (ISO) */
  happyCallCompletedAt?: string | null;
  operatingCompanyId?: string | null;
  operatingCompany?: {
    id: string;
    name: string;
    slug: string;
    isActive?: boolean;
    badgeColorKey?: string | null;
  } | null;
  createdBy?: { id: string; name: string } | null;
  orderForm?: {
    id: string;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    submittedAt?: string | null;
    customerSpecialNotes?: string | null;
    /** 동적 발주서 추가 항목 답변 {fieldKey: value} */
    customerAnswers?: Record<string, unknown> | null;
    /** 발주서 양식(카테고리) — 배지·추가정보 라벨 */
    template?: {
      id: string;
      title: string;
      icon: string | null;
      isDefault?: boolean;
      fields?: Array<{ fieldKey: string; label: string }>;
    } | null;
    createdBy?: { id: string; name: string };
  } | null;
  assignments: Array<{
    teamLeader: {
      id: string;
      name: string;
      role?: string;
      externalCompany?: { id: string; name: string } | null;
    };
  }>;
  changeLogs?: InquiryChangeLogEntry[];
  /** 인천 주안 기준 직선거리(km) */
  distanceFromJuanKm?: number | null;
  /** 테넌트 DB 거래 — 송신·수신 배지용 */
  tenantShare?: TenantInquiryShareMeta | null;
  /** 과거 현장 추가 금액(InquiryExtraCharge). 신규 추가결재는 additionalReceipts */
  extraCharges?: Array<{
    id: string;
    description: string;
    amount: number;
    sortOrder?: number;
    createdBy?: { id: string; name: string } | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  /** 추가결재 — 일반 금액과 분리 · 별도 정산 */
  additionalReceipts?: Array<{
    id: string;
    description: string;
    amount: number;
    settlementChannel?: 'COMPANY_DEPOSIT' | 'FIELD_RECEIVED';
    sortOrder?: number;
    createdBy?: { id: string; name: string } | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
}

/**
 * @param options.lite `false`이면 이전과 동일한 풀 include(발주서 금액·추가정산·긴 본문 필드 포함). 기본 `true`는 목록 전용으로 응답·DB 조인을 줄임.
 */
export async function getSchedule(
  token: string,
  start: string,
  end: string,
  options?: { lite?: boolean }
): Promise<{ items: ScheduleItem[] }> {
  const useLite = options?.lite !== false;
  const q = new URLSearchParams({ start, end });
  if (useLite) q.set('lite', '1');
  const res = await fetch(`${API}/schedule?${q.toString()}`, { headers: headers(token) });
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
