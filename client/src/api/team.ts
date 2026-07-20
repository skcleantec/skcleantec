import type { CsReport } from './cs';
import { API } from './apiPrefix';
import { AuthSessionExpiredError, type ExternalCompanyOnboarding } from './auth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type TeamInquiriesListParams = {
  datePreset?: 'today' | 'all' | 'month' | 'day';
  month?: string;
  day?: string;
  dateBasis?: 'assignedAt' | 'createdAt' | 'preferredDate';
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export async function getTeamInquiries(token: string, params?: TeamInquiriesListParams) {
  const qs = new URLSearchParams();
  if (params) {
    if (params.datePreset) qs.set('datePreset', params.datePreset);
    if (params.month) qs.set('month', params.month);
    if (params.day) qs.set('day', params.day);
    if (params.dateBasis) qs.set('dateBasis', params.dateBasis);
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
  }
  const q = qs.toString();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/inquiries${q ? `?${q}` : ''}`), {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('담당 건을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: unknown[]; total?: number }>;
}

/** 단일 담당 접수 상세 (변경 이력 종 → 접수 이동용 딥링크) */
export async function getTeamInquiry(token: string, inquiryId: string): Promise<unknown> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}`),
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error('담당 접수를 불러올 수 없습니다.');
  return res.json();
}

export interface TeamViewerMe {
  id: string;
  email?: string | null;
  role: string;
  name?: string | null;
  /** 팀장 전용 로마자 이름 */
  nameEn?: string | null;
  phone?: string | null;
  vehicleNumber?: string | null;
  allowSelfDayOffEdit?: boolean;
  externalCompanyId?: string | null;
  externalCompany?: ExternalCompanyOnboarding | { id: string; name: string } | null;
  viewerRole?: string;
  previewExternal?: boolean;
  previewTeamLeader?: boolean;
  staffIdCardUrl?: string | null;
  hireDate?: string | null;
  tenant?: { id: string; name: string; displayName: string; slug?: string } | null;
  features?: string[];
  profileCompletedAt?: string | null;
  profileOnboardingRequired?: boolean;
}

export async function getTeamMe(token: string): Promise<TeamViewerMe> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/me`), { headers: headers(token) });
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) throw new Error('팀 사용자 정보를 불러올 수 없습니다.');
  return res.json();
}

export async function getTeamSchedule(token: string, start: string, end: string) {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/schedule?${q}`), { headers: headers(token) });
  if (!res.ok) throw new Error('스케줄을 불러올 수 없습니다.');
  return res.json();
}

export interface TeamExternalSettlementItem {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  address: string;
  addressDetail: string | null;
  preferredDate: string | null;
  status: string;
  isCancelled: boolean;
  feeAmount: number;
  signedFeeAmount: number;
  assignedExternalLabel: string | null;
}

export type TeamExternalSettlementListParams = {
  datePreset?: 'today' | 'all' | 'month' | 'day';
  month?: string;
  day?: string;
  limit?: number;
  offset?: number;
  payLimit?: number;
  payOffset?: number;
  externalCompanyId?: string;
  externalCompanyName?: string;
  operatingCompanyId?: string;
  search?: string;
};

export type TeamSettlementOperatingCompanyItem = {
  id: string;
  name: string;
  displayName: string;
  isDefault?: boolean;
};

export interface TeamExternalSettlementResponse {
  month: string;
  from: string;
  to: string;
  operatingCompanyId: string;
  operatingCompanies?: TeamSettlementOperatingCompanyItem[];
  externalCompanyId: string;
  externalCompanyName: string | null;
  inquiryCount: number;
  cancelledInquiryCount: number;
  totalCount: number;
  totalFee: number;
  periodPositiveFee: number;
  periodNegativeFee: number;
  itemsTotal: number;
  paymentsTotal: number;
  carryOverAmount: number;
  payableAmount: number;
  periodPaidAmount: number;
  remainingAmount: number;
  /** 올해(한국 달력) 기준 요약 */
  summaryYear: string;
  yFromYmd: string;
  yToYmd: string;
  yearTotalFee: number;
  yearCarryOverAmount: number;
  yearPayableAmount: number;
  yearPeriodPaidAmount: number;
  yearRemainingAmount: number;
  lastSettlementPayment: { amount: number; paidAt: string } | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    memo: string | null;
    actorName: string | null;
    actorRole: string | null;
    /** 누적(전체) 인정 수수료에서 시점순 정산완료를 모두 반영한 뒤 남은 금액(관리자 정산·미수와 동일 기준) */
    outstandingAfterCumulative: number;
  }>;
  items: TeamExternalSettlementItem[];
}

export async function getTeamExternalSettlement(
  token: string,
  params: TeamExternalSettlementListParams
): Promise<TeamExternalSettlementResponse> {
  const q = new URLSearchParams();
  if (params.datePreset) q.set('datePreset', params.datePreset);
  if (params.month) q.set('month', params.month);
  if (params.day) q.set('day', params.day);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.payLimit != null) q.set('payLimit', String(params.payLimit));
  if (params.payOffset != null) q.set('payOffset', String(params.payOffset));
  if (params.externalCompanyId) q.set('externalCompanyId', params.externalCompanyId);
  if (params.externalCompanyName) q.set('externalCompanyName', params.externalCompanyName);
  if (params.operatingCompanyId?.trim()) q.set('operatingCompanyId', params.operatingCompanyId.trim());
  if (params.search?.trim()) q.set('search', params.search.trim());
  const res = await fetch(withTeamPreviewQuery(`${API}/team/external-settlement?${q}`), {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '타업체 정산 정보를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function postTeamExternalSettlementPayment(
  token: string,
  params: { externalCompanyId: string; amount: number; memo?: string; operatingCompanyId?: string }
): Promise<void> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/external-settlement/payments`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산완료 처리에 실패했습니다.');
  }
}

export async function getTeamHappyCallStats(token: string): Promise<{
  overdueCount: number;
  pendingBeforeDeadlineCount: number;
}> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/happy-call-stats`), { headers: headers(token) });
  if (!res.ok) throw new Error('해피콜 통계를 불러올 수 없습니다.');
  return res.json();
}

export async function completeTeamHappyCall(token: string, inquiryId: string): Promise<void> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/inquiries/${inquiryId}/happy-call-complete`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : '해피콜 완료 처리에 실패했습니다.');
  }
}

export async function markTeamInspectionMissed(token: string, inquiryId: string): Promise<unknown> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/inspection-missed`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : '검수 누락 처리에 실패했습니다.');
  }
  return res.json();
}

export async function patchTeamInquiryPreferredDate(
  token: string,
  inquiryId: string,
  preferredDate: string
) {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/preferred-date`), {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ preferredDate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : '예약일 변경에 실패했습니다.');
  }
  return res.json();
}

/** 팀장: 크루 현장 일정용 미팅 시각 — 공용 또는 팀원별(KST HH:mm) */
export type CrewMeetingTimePatch =
  | { shared: true; crewMeetingTime: string | null }
  | { shared: false; memberTimes: Array<{ teamMemberId: string; meetingTime: string }> };

export async function patchTeamInquiryCrewMeetingTime(
  token: string,
  inquiryId: string,
  payload: CrewMeetingTimePatch,
) {
  const body =
    payload.shared === true
      ? { shared: true, crewMeetingTime: payload.crewMeetingTime }
      : { shared: false, memberTimes: payload.memberTimes };

  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/crew-meeting-time`),
    {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const raw = await res.text();
    let message = '';
    try {
      const j = JSON.parse(raw) as { error?: unknown };
      if (typeof j.error === 'string' && j.error.trim()) message = j.error.trim();
    } catch {
      if (raw.trim()) message = raw.trim().slice(0, 300);
    }
    if (!message) {
      message =
        res.status === 401
          ? '로그인이 만료되었거나 권한이 없습니다.'
          : res.status === 404
            ? '담당 접수를 찾을 수 없습니다.'
            : `미팅 시각 저장에 실패했습니다. (HTTP ${res.status})`;
    }
    throw new Error(message);
  }
  return res.json();
}

/** 팀장 GNB: 미읽 메시지 + 담당 미처리(접수) C/S + 미확인 배정 — 한 요청 */
export async function getTeamNavBadges(token: string): Promise<{
  unreadCount: number;
  csPendingCount: number;
  newAssignmentCount: number;
  eContractPendingCount: number;
  marketplacePendingCount: number;
}> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/nav-badges`), { headers: headers(token) });
  if (!res.ok) throw new Error('배지 정보를 불러올 수 없습니다.');
  const j = await res.json();
  return {
    unreadCount: Number(j.unreadCount) || 0,
    csPendingCount: Number(j.csPendingCount) || 0,
    newAssignmentCount: Number(j.newAssignmentCount) || 0,
    eContractPendingCount: Number(j.eContractPendingCount) || 0,
    marketplacePendingCount: Number(j.marketplacePendingCount) || 0,
  };
}

export type TeamLeaderEContractIssuanceItem = {
  id: string;
  token: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  notes?: string | null;
  definitionId: string;
  definitionTitle: string;
  definitionArchived: boolean;
  versionOrdinal: number | null;
  versionTitle: string;
  signedAt: string | null;
  hasSigned: boolean;
};

export async function listTeamEContractIssuances(
  token: string,
  params: {
    datePreset?: string;
    month?: string;
    day?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ items: TeamLeaderEContractIssuanceItem[]; total: number }> {
  const q = new URLSearchParams();
  if (params.datePreset) q.set('datePreset', params.datePreset);
  if (params.month) q.set('month', params.month);
  if (params.day) q.set('day', params.day);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/e-contracts/issuances${qs ? `?${qs}` : ''}`),
    { headers: headers(token) }
  );
  if (res.status === 403 || res.status === 401) {
    throw new Error('팀장 전용 기능입니다.');
  }
  if (!res.ok) {
    throw new Error('계약 초대 목록을 불러올 수 없습니다.');
  }
  const j = (await res.json()) as { items?: TeamLeaderEContractIssuanceItem[]; total?: number };
  return {
    items: Array.isArray(j.items) ? j.items : [],
    total: typeof j.total === 'number' ? j.total : 0,
  };
}

/** 팀장: 접수 상세 확인 처리 — 상단 배정 배지 감소 */
export async function postTeamInquiryDetailViewed(token: string, inquiryId: string): Promise<void> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/detail-viewed`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : '확인 처리에 실패했습니다.');
  }
}

/** 팀장: 담당 미처리(접수) C/S 건수 */
export async function getTeamCsPendingCount(token: string): Promise<{ count: number }> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cs/pending-count`), { headers: headers(token) });
  if (!res.ok) throw new Error('C/S 건수를 불러올 수 없습니다.');
  return res.json();
}

/** 팀장: 담당 접수와 연결된 C/S 목록 */
export async function getTeamCsReports(token: string): Promise<{ items: CsReport[] }> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cs`), { headers: headers(token) });
  if (!res.ok) throw new Error('C/S 목록을 불러올 수 없습니다.');
  const json = await res.json();
  return {
    items: (json.items || []).map((i: CsReport) => ({
      ...i,
      imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
      serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : null,
    })),
  };
}

/** 팀장/타업체: C/S 상세 확인 — 접수 건은 처리중으로 전환(미확인 배지 해제) */
export async function acknowledgeTeamCsReport(token: string, id: string): Promise<CsReport> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cs/${encodeURIComponent(id)}/acknowledge`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'C/S 확인에 실패했습니다.');
  }
  const i = await res.json();
  return {
    ...i,
    imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
    serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : null,
  };
}

/** 팀장: 담당 C/S 수정 */
export async function patchTeamCsReport(
  token: string,
  id: string,
  data: {
    status?: string;
    memo?: string | null;
    completionMethod?: string | null;
    asServiceDate?: string | null;
  }
): Promise<CsReport> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cs/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수정에 실패했습니다.');
  }
  const i = await res.json();
  return {
    ...i,
    imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
    serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : null,
  };
}
