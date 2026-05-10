import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type AdChannelSettlementMode = 'DIRECT_AMOUNT' | 'COUNT_LINES';

export interface AdChannelLineItem {
  id: string;
  channelId: string;
  label: string;
  unitAmountWon: number;
  countsForSpend: boolean;
  useAsAvgDenominator: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface AdChannel {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  settlementMode?: AdChannelSettlementMode;
  lineItems?: AdChannelLineItem[];
}

export async function getAdChannels(token: string, all?: boolean): Promise<{ items: AdChannel[] }> {
  const q = all ? '?all=1' : '';
  const res = await fetch(`${API}/advertising/channels${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error('채널 목록을 불러올 수 없습니다.');
  return res.json();
}

/** 관리자: 비활성 채널 포함 전체 + 과목 (정산 설정 화면) */
export async function getAdvertisingSettlementConfig(token: string): Promise<{ items: AdChannel[] }> {
  const res = await fetch(`${API}/advertising/settlement-config`, { headers: headers(token) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '정산 설정을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function patchAdChannelSettlementMode(
  token: string,
  channelId: string,
  settlementMode: AdChannelSettlementMode
): Promise<AdChannel> {
  const res = await fetch(`${API}/advertising/channels/${channelId}/settlement-mode`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ settlementMode }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '정산 방식 변경에 실패했습니다.');
  }
  return res.json();
}

export async function createAdChannelLineItem(
  token: string,
  channelId: string,
  data: {
    label: string;
    unitAmountWon: number;
    countsForSpend?: boolean;
    sortOrder?: number;
  }
): Promise<AdChannelLineItem> {
  const res = await fetch(`${API}/advertising/channels/${channelId}/line-items`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '과목 추가에 실패했습니다.');
  }
  return res.json();
}

export async function updateAdChannelLineItem(
  token: string,
  lineItemId: string,
  data: {
    label?: string;
    unitAmountWon?: number;
    countsForSpend?: boolean;
    sortOrder?: number;
  }
): Promise<AdChannelLineItem> {
  const res = await fetch(`${API}/advertising/line-items/${lineItemId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '과목 수정에 실패했습니다.');
  }
  return res.json();
}

export async function deleteAdChannelLineItem(token: string, lineItemId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/advertising/line-items/${lineItemId}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '과목 삭제에 실패했습니다.');
  }
  return res.json();
}

export async function createAdChannel(token: string, name: string, sortOrder?: number): Promise<AdChannel> {
  const res = await fetch(`${API}/advertising/channels`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ name, sortOrder }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '채널 추가에 실패했습니다.');
  }
  return res.json();
}

export async function updateAdChannel(
  token: string,
  id: string,
  data: { name?: string; isActive?: boolean; sortOrder?: number }
): Promise<AdChannel> {
  const res = await fetch(`${API}/advertising/channels/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '채널 수정에 실패했습니다.');
  }
  return res.json();
}

export async function reorderAdChannels(token: string, orderedIds: string[]): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/advertising/channels/reorder`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ orderedIds }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '순서 저장에 실패했습니다.');
  }
  return res.json();
}

export async function deleteAdChannel(token: string, id: string, password: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/advertising/channels/${id}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '삭제에 실패했습니다.');
  }
  return res.json();
}

export interface ActiveSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
}

export async function getActiveAdSession(token: string): Promise<{ session: ActiveSession | null }> {
  const res = await fetch(`${API}/advertising/sessions/active`, { headers: headers(token) });
  if (!res.ok) throw new Error('세션 정보를 불러올 수 없습니다.');
  return res.json();
}

export async function startAdSession(token: string): Promise<ActiveSession> {
  const res = await fetch(`${API}/advertising/sessions/start`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '시작할 수 없습니다.');
  }
  return res.json();
}

/** 종료 모달 — 발주서 제출 건수 자동 집계 미리보기 */
export interface BookingDenominatorPreview {
  sessionId?: string | null;
  rangeStartIso: string | null;
  autoCount: number;
}

export async function getBookingDenominatorPreview(token: string): Promise<BookingDenominatorPreview> {
  const res = await fetch(`${API}/advertising/sessions/booking-denominator-preview`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('예약 건수 미리보기를 불러올 수 없습니다.');
  return res.json();
}

export type EndAdSessionLine =
  | { channelId: string; amount: number }
  | { channelId: string; lineCounts: Record<string, number> };

export async function endAdSession(
  token: string,
  lines: EndAdSessionLine[],
  opts?: { bookingDenominator?: { manual: boolean; manualCount?: number } }
): Promise<{ session: unknown }> {
  const body: Record<string, unknown> = { lines };
  if (opts?.bookingDenominator) body.bookingDenominator = opts.bookingDenominator;
  const res = await fetch(`${API}/advertising/sessions/end`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '종료 처리에 실패했습니다.');
  }
  return res.json();
}

export interface AdvertisingAnalytics {
  period: { from: string; to: string; days: number };
  summary: {
    totalAdSpend: number;
    /** 조회 기간 내 작업 종료 세션별 예약 분모(수동·자동) 합 — ROAS·건당 비용 분모 */
    orderInquiryCount: number;
    totalRevenue: number;
    roas: number | null;
    costPerInquiry: number | null;
    avgDailySpend: number;
  };
  byUser: {
    userId: string;
    name: string;
    email: string;
    role: string;
    totalAdSpend: number;
    /** 동일: 기간 내 종료 세션 분모 합 */
    orderInquiryCount: number;
    totalRevenue: number;
    roas: number | null;
    costPerInquiry: number | null;
    avgDailySpend: number;
  }[];
}

export async function getAdvertisingAnalytics(
  token: string,
  from: string,
  to: string,
  marketerId?: string | null
): Promise<AdvertisingAnalytics> {
  const q = new URLSearchParams({ from, to });
  if (marketerId) q.set('marketerId', marketerId);
  const res = await fetch(`${API}/advertising/analytics?${q}`, { headers: headers(token) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '집계를 불러올 수 없습니다.');
  }
  return res.json();
}

export type AdSpendCountBreakdownRow = {
  lineItemId: string;
  label: string;
  unitAmountWon: number;
  count: number;
  countsForSpend: boolean;
  useAsAvgDenominator: boolean;
  lineAmountWon: number;
};

export interface HistorySession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  spendLines: {
    amount: number;
    channel: AdChannel;
    soomgoReceivedCount?: number | null;
    soomgoAutoEstimateCount?: number | null;
    soomgoConfirmedCount?: number | null;
    countBreakdown?: AdSpendCountBreakdownRow[] | null;
  }[];
  user: { id: string; name: string; email: string; role: string };
}

export async function getAdSessionHistory(
  token: string,
  from: string,
  to: string,
  marketerId?: string | null
): Promise<{ items: HistorySession[] }> {
  const q = new URLSearchParams({ from, to });
  if (marketerId) q.set('marketerId', marketerId);
  const res = await fetch(`${API}/advertising/sessions/history?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error('이력을 불러올 수 없습니다.');
  return res.json();
}
