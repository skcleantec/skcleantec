const API = '/api';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export interface ScheduleItem {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  status: string;
  claimMemo?: string | null;
  assignments: Array<{ teamLeader: { id: string; name: string } }>;
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
