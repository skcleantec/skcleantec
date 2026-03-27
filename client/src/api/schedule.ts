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
  preferredTimeDetail?: string | null;
  status: string;
  source?: string | null;
  memo?: string | null;
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
