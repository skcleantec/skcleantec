import type { CsReport } from './cs';
import { API } from './apiPrefix';
import { AuthSessionExpiredError } from './auth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getTeamInquiries(token: string) {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/inquiries`), { headers: headers(token) });
  if (!res.ok) throw new Error('담당 건을 불러올 수 없습니다.');
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
  externalCompany?: { id: string; name: string } | null;
  viewerRole?: string;
  previewExternal?: boolean;
  previewTeamLeader?: boolean;
  /** 관리자 업로드 사원증(Cloudinary). 모바일에서 열람 */
  staffIdCardUrl?: string | null;
  /** 입사일 — 사원증 하단 인증 문구용 */
  hireDate?: string | null;
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

export interface TeamExternalSettlementResponse {
  month: string;
  from: string;
  to: string;
  externalCompanyId: string;
  externalCompanyName: string | null;
  inquiryCount: number;
  cancelledInquiryCount: number;
  totalCount: number;
  totalFee: number;
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
  params: { from: string; to: string; externalCompanyId?: string; externalCompanyName?: string }
): Promise<TeamExternalSettlementResponse> {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.externalCompanyId) q.set('externalCompanyId', params.externalCompanyId);
  if (params.externalCompanyName) q.set('externalCompanyName', params.externalCompanyName);
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
  params: { externalCompanyId: string; amount: number; memo?: string }
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

/** 팀장: 크루 현장 일정용 미팅 시각(KST HH:mm 또는 null). 오전 희망 시에만 유효 */
export async function patchTeamInquiryCrewMeetingTime(
  token: string,
  inquiryId: string,
  crewMeetingTime: string | null,
) {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/inquiries/${encodeURIComponent(inquiryId)}/crew-meeting-time`),
    {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ crewMeetingTime }),
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
}> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/nav-badges`), { headers: headers(token) });
  if (!res.ok) throw new Error('배지 정보를 불러올 수 없습니다.');
  const j = await res.json();
  return {
    unreadCount: Number(j.unreadCount) || 0,
    csPendingCount: Number(j.csPendingCount) || 0,
    newAssignmentCount: Number(j.newAssignmentCount) || 0,
    eContractPendingCount: Number(j.eContractPendingCount) || 0,
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

export async function listTeamEContractIssuances(token: string): Promise<{ items: TeamLeaderEContractIssuanceItem[] }> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/e-contracts/issuances`), { headers: headers(token) });
  if (res.status === 403 || res.status === 401) {
    throw new Error('팀장 전용 기능입니다.');
  }
  if (!res.ok) {
    throw new Error('계약 초대 목록을 불러올 수 없습니다.');
  }
  const j = (await res.json()) as { items?: TeamLeaderEContractIssuanceItem[] };
  return {
    items: Array.isArray(j.items) ? j.items : [],
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
