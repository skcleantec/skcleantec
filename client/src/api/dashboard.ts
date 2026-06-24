import { API, apiErrorMessage } from './apiPrefix';
import { isLikelyNetworkFailure } from './fetchNetwork';

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. npm run dev 로 API와 Vite를 함께 켜 주세요. Cursor 내장 브라우저는 루프백에서 자동으로 API에 직접 붙습니다.'
  );
}

export interface DashboardStats {
  todayCount: number;
  unassignedCount: number;
  todaySales: number;
  monthSales: number;
  salesByTeamLeader: Array<{ teamLeaderId: string; name: string; amount: number }>;
  dailySales: Array<{ date: string; amount: number }>;
  /** 배정·예약일 있는 해피콜 미완 중 마감(작업일 전날 KST 말일) 지남 */
  happyCallOverdueCount: number;
  /** 마감 전 미완 */
  happyCallPendingBeforeDeadlineCount: number;
  /** 이번 달 접수일(KST)·취소 제외·팀장 배정 건수·주안 km 누적합·최대 km — 1차 배정 팀장 */
  teamLeaderWorkloadThisMonth: Array<{
    teamLeaderId: string;
    name: string;
    jobCount: number;
    maxKmFromJuan: number;
    sumKmFromJuan: number;
  }>;
  teamLeaderDayOffToday: Array<{ teamLeaderId: string; name: string }>;
  teamMembersDailyRosterRestToday: Array<{ teamMemberId: string; name: string }>;
  dailyRosterModeActive: boolean;
}

export type OpsHourlyMetricId =
  | 'order_form_issued'
  | 'order_form_submitted'
  | 'inquiry_received'
  | 'followup_absent'
  | 'followup_on_hold'
  | 'followup_reserved';

export type OpsHourlyMetric = {
  id: OpsHourlyMetricId;
  label: string;
  description: string;
  hourly: number[];
  total: number;
  peakHour: number;
  peakCount: number;
  peakLabel: string;
};

export type OpsHeatmapPeak = {
  dow: number;
  hour: number;
  count: number;
  label: string;
};

export type OpsHeatmap = {
  metricId: 'order_form_issued';
  grid: number[][];
  weekdayLabels: string[];
  total: number;
  peak: OpsHeatmapPeak;
};

export type OpsOpenBacklog = {
  absent: number;
  onHold: number;
  total: number;
};

export type OpsConversionByHour = {
  hourlyRate: number[];
  peakHour: number;
  peakRatePct: number;
};

export type OpsHourlySummary = {
  periodDays: number;
  periodStartYmd: string;
  periodEndYmd: string;
  primaryPeak: {
    metricId: OpsHourlyMetricId;
    hour: number;
    count: number;
    label: string;
  };
  metrics: OpsHourlyMetric[];
  heatmap: OpsHeatmap;
  openBacklog: OpsOpenBacklog;
  conversionByHour: OpsConversionByHour;
};

export type DashboardInquiryBreakdown = {
  monthKey: string;
  byRegion: Array<{
    regionKey: string;
    label: string;
    sidoKey: string | null;
    inquiryCount: number;
    salesAmount: number;
  }>;
  bySidoMap: Array<{
    sidoKey: string;
    label: string;
    inquiryCount: number;
    salesAmount: number;
  }>;
  byMonth: Array<{
    monthKey: string;
    inquiryCount: number;
    salesAmount: number;
  }>;
  byPreferredDate: Array<{
    date: string;
    inquiryCount: number;
  }>;
};

export type DashboardSidoMapBucket = DashboardInquiryBreakdown['bySidoMap'][number];

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  let res: Response;
  try {
    res = await fetch(`${API}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw apiUnreachableMessage();
    }
    throw new Error(await apiErrorMessage(res, '통계를 불러올 수 없습니다.'));
  }
  return res.json();
}

export async function getDashboardOpsHourly(
  token: string,
  days: 7 | 30 | 90 = 30,
): Promise<OpsHourlySummary> {
  let res: Response;
  try {
    res = await fetch(`${API}/dashboard/ops-hourly?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '운영 시간대 통계를 불러올 수 없습니다.'));
  }
  return res.json();
}

export async function getDashboardInquiryBreakdown(
  token: string,
  month?: string,
): Promise<DashboardInquiryBreakdown> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  let res: Response;
  try {
    res = await fetch(`${API}/dashboard/inquiry-breakdown${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw apiUnreachableMessage();
    }
    throw new Error(await apiErrorMessage(res, '접수 분석 통계를 불러올 수 없습니다.'));
  }
  return res.json();
}

export type DashboardSalesBreakdown = {
  monthKey: string;
  totalSales: number;
  inquiryCount: number;
  dailySales: Array<{ date: string; amount: number; inquiryCount: number }>;
  salesByTeamLeader: Array<{ teamLeaderId: string; name: string; amount: number }>;
};

export async function getDashboardSalesBreakdown(
  token: string,
  month?: string,
): Promise<DashboardSalesBreakdown> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  let res: Response;
  try {
    res = await fetch(`${API}/dashboard/sales-breakdown${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '매출 통계를 불러올 수 없습니다.'));
  }
  return res.json();
}

export type DashboardSettlementSummaryRow = {
  teamLeaderId: string;
  name: string;
  assignedJobCount: number;
  settlementDueTotal: number | null;
  paidTotal: number;
  unsettledCombined: number;
};

export type DashboardSettlementSummary = {
  monthKey: string;
  rows: DashboardSettlementSummaryRow[];
  totals: {
    settlementDueTotal: number;
    paidTotal: number;
    unsettledCombined: number;
  };
};

export async function getDashboardSettlementSummary(
  token: string,
  month?: string,
): Promise<DashboardSettlementSummary> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  let res: Response;
  try {
    res = await fetch(`${API}/dashboard/settlement-summary${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '정산 통계를 불러올 수 없습니다.'));
  }
  return res.json();
}

export async function getDashboardOpsHourlyRange(
  token: string,
  fromYmd: string,
  toYmd: string,
): Promise<OpsHourlySummary> {
  const qs = new URLSearchParams({ fromYmd, toYmd });
  let res: Response;
  try {
    res = await fetch(`${API}/dashboard/ops-hourly?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '운영 시간대 통계를 불러올 수 없습니다.'));
  }
  return res.json();
}
