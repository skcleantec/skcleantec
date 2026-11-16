import { crmWorkBrandQueryString } from '../utils/crmWorkBrandQuery';

const API = '/api/crm/quick-schedule';

export type CrmQuickScheduleKind = 'ASAP' | 'DATE' | 'WITHIN_WEEK' | 'FLEXIBLE' | 'UNKNOWN';

export type CrmQuickScheduleFollowup = {
  id: string;
  status: string;
  deferCount: number;
  handlerName: string | null;
  inquiryId: string | null;
  customerPhone: string;
  customerPhone2: string | null;
};

export type CrmQuickScheduleItem = {
  id: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  leadSource: string;
  preferredKind: CrmQuickScheduleKind;
  preferredYmd: string | null;
  preferredAnswerRaw: string;
  serviceType: string | null;
  address: string | null;
  areaPyeong: number | null;
  fetchedAt: string;
  inquiryId: string | null;
  followup: CrmQuickScheduleFollowup | null;
};

export type CrmQuickScheduleList = {
  todayYmd: string;
  counts: { all: number; asap: number; week: number };
  items: CrmQuickScheduleItem[];
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '요청에 실패했습니다.');
  return data;
}

export async function fetchCrmQuickSchedule(token: string, operatingCompanyId: string): Promise<CrmQuickScheduleList> {
  const res = await fetch(`${API}${crmWorkBrandQueryString(operatingCompanyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(res);
}

export async function saveCrmQuickScheduleLead(
  token: string,
  body: {
    operatingCompanyId: string;
    leadSource: '숨고' | '미소';
    customerName?: string;
    nickname?: string;
    customerPhone?: string;
    preferredAnswerRaw?: string;
    serviceType?: string;
    address?: string;
    areaPyeong?: number | null;
  },
): Promise<{ saved: boolean }> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}
