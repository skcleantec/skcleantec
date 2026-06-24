/** 대시보드 매출·접수 분석 공통 — `/dashboard/stats` · `/dashboard/inquiry-breakdown` 단일 기준 */

export const SALES_AMOUNT_STATUSES = [
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CS_PROCESSING',
  'ON_HOLD',
] as const;

export function getInquiryAmount(
  inq: {
    orderForm?: { totalAmount: number } | null;
    serviceTotalAmount?: number | null;
    areaPyeong: number | null;
    extraCharges?: { amount: number }[] | null;
  },
  pricePerPyeong: number,
): number {
  const base =
    inq.orderForm?.totalAmount != null
      ? inq.orderForm.totalAmount
      : inq.serviceTotalAmount != null && inq.serviceTotalAmount > 0
        ? inq.serviceTotalAmount
        : inq.areaPyeong != null && inq.areaPyeong > 0
          ? Math.round(inq.areaPyeong * pricePerPyeong)
          : 0;
  const extra = inq.extraCharges?.reduce((sum, c) => sum + (c.amount ?? 0), 0) ?? 0;
  return base + extra;
}

/** 매출·접수 집계 기준일(KST): 접수일(createdAt) */
export function effectiveSalesDateYmd(inquiry: { createdAt: Date }): string {
  return inquiry.createdAt.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 예약일(preferredDate) KST YYYY-MM-DD */
export function preferredDateYmd(preferredDate: Date): string {
  return preferredDate.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function kstYmdAddDays(ymd: string, deltaDays: number): string {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** monthKey YYYY-MM 기준 delta개월 이동 (달력 월) */
export function kstMonthKeyAddMonths(monthKey: string, deltaMonths: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = new Date(Date.UTC(y, mo + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

/** 현재 월 포함 최근 count개월 monthKey (오름차순) */
export function kstRecentMonthKeys(count: number, anchorMonthKey: string): string[] {
  const n = Math.max(1, Math.min(count, 24));
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(kstMonthKeyAddMonths(anchorMonthKey, -i));
  }
  return keys;
}
