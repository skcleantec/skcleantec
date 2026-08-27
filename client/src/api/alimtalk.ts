import {
  ALIMTALK_CHARGE_MAX_KRW,
  ALIMTALK_CHARGE_UNIT_KRW,
  type AlimtalkTemplateCode,
} from '@shared/alimtalkPolicy';
import { SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX } from '@shared/alimtalkScheduleD2Timing';
import { API, apiErrorMessage } from './apiPrefix';

export type TenantAlimtalkChargeRequest = {
  id: string;
  amountKrw: number;
  memo: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  reviewedAt: string | null;
};

export type TenantAlimtalkSettings = {
  licensed: boolean;
  planAllows: boolean;
  plan: string;
  monthlyFreeEnabled: boolean;
  monthlyFreeQuota: number;
  monthlyFreeUsed: number;
  monthlyFreeRemaining: number;
  prepaidBalanceKrw: number;
  unitPriceAtaKrw: number;
  unitPriceLmsKrw: number;
  canSend: boolean;
  bank: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    paymentGuideText: string | null;
  };
  templates: { code: string; label: string; enabled: boolean }[];
  scheduleD2DaysBeforePenalty: number | null;
  scheduleD2SendHourKst: number;
  pendingChargeRequest: TenantAlimtalkChargeRequest | null;
  recentChargeRequests: TenantAlimtalkChargeRequest[];
  recentChargeLogs: {
    id: string;
    amountKrw: number;
    balanceAfterKrw: number;
    memo: string | null;
    createdAt: string;
  }[];
};

export type AlimtalkSendLogListItem = {
  id: string;
  createdAt: string;
  templateCode: string;
  inquiryId: string | null;
  inquiryNumber: string | null;
  customerName: string | null;
  preferredDateYmd: string | null;
  toPhone: string;
  status: 'success' | 'failed' | 'pending';
  deliveredChannel: string | null;
  errorMessage: string | null;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getTenantAlimtalkSettings(token: string): Promise<TenantAlimtalkSettings> {
  const res = await fetch(`${API}/alimtalk/settings`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '알림톡 설정 조회 실패'));
  return res.json() as Promise<TenantAlimtalkSettings>;
}

export async function patchTenantAlimtalkSettings(
  token: string,
  body: {
    templates?: { code: AlimtalkTemplateCode; enabled: boolean }[];
    scheduleD2DaysBeforePenalty?: number | null;
  },
): Promise<TenantAlimtalkSettings> {
  const res = await fetch(`${API}/alimtalk/settings`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '알림톡 설정 저장 실패');
  }
  return res.json() as Promise<TenantAlimtalkSettings>;
}

export async function getTenantAlimtalkSendLogs(
  token: string,
  params?: { templateCode?: AlimtalkTemplateCode; limit?: number; offset?: number },
): Promise<{ items: AlimtalkSendLogListItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.templateCode) qs.set('templateCode', params.templateCode);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const query = qs.toString();
  const res = await fetch(`${API}/alimtalk/send-logs${query ? `?${query}` : ''}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '발송 내역 조회 실패'));
  return res.json() as Promise<{ items: AlimtalkSendLogListItem[]; total: number }>;
}

export async function postTenantAlimtalkChargeRequest(
  token: string,
  body: { amountKrw: number; memo?: string },
): Promise<TenantAlimtalkSettings> {
  const res = await fetch(`${API}/alimtalk/charge-requests`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '충전 신청 실패');
  }
  return res.json() as Promise<TenantAlimtalkSettings>;
}

export const TENANT_ALIMTALK_CHARGE_PRESETS_KRW = [
  ALIMTALK_CHARGE_UNIT_KRW,
  ALIMTALK_CHARGE_UNIT_KRW * 2,
  ALIMTALK_CHARGE_UNIT_KRW * 3,
  ALIMTALK_CHARGE_MAX_KRW,
] as const;

export { SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX };
