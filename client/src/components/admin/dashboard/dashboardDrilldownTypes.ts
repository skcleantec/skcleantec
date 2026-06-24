export type DashboardDrillKind =
  | 'region'
  | 'monthly-inquiry'
  | 'preferred-date'
  | 'ops-hourly'
  | 'sales';

export type DashboardDrillRequest = {
  kind: DashboardDrillKind;
  initialMonth?: string;
  initialFromYmd?: string;
  initialToYmd?: string;
};

export function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

export function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function monthTitleKo(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

export function formatCurrencyKo(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

export const DRILL_KIND_LABELS: Record<DashboardDrillKind, string> = {
  region: '지역별 접수',
  'monthly-inquiry': '월별 접수·매출',
  'preferred-date': '예약일별 작업',
  'ops-hourly': '운영 시간대',
  sales: '매출 및 정산',
};
