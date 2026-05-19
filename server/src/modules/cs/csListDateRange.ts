/** C/S 목록 — 접수일(createdAt) 기준, KST */

import { kstDayRangeYmd, kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';

export type CsListDatePreset = 'last3months' | 'month' | 'day';

/** 오늘 포함 최근 3개월(당월·전월·전전월 1일 00:00 ~ 오늘 23:59 KST) */
export function kstLast3MonthsRange(): { gte: Date; lte: Date } {
  const todayYmd = kstTodayYmd();
  const [y, m] = todayYmd.split('-').map(Number);
  let startMo = m - 2;
  let startY = y;
  while (startMo < 1) {
    startMo += 12;
    startY -= 1;
  }
  const startYmd = `${startY}-${String(startMo).padStart(2, '0')}-01`;
  const start = kstDayRangeYmd(startYmd);
  const end = kstDayRangeYmd(todayYmd);
  if (!start || !end) {
    const fallback = kstDayRangeYmd(todayYmd);
    return fallback ?? { gte: new Date(), lte: new Date() };
  }
  return { gte: start.gte, lte: end.lte };
}

export function csCreatedAtRangeFromQuery(query: {
  datePreset?: string;
  month?: string;
  day?: string;
}): { gte: Date; lte: Date } {
  const preset = (query.datePreset ?? 'last3months') as CsListDatePreset;
  if (preset === 'last3months') {
    return kstLast3MonthsRange();
  }
  if (preset === 'month') {
    const mk = typeof query.month === 'string' ? query.month.trim() : '';
    const range = mk ? kstMonthRangeYm(mk) : kstMonthRangeYm(kstTodayYmd().slice(0, 7));
    if (!range) return kstLast3MonthsRange();
    return range;
  }
  if (preset === 'day') {
    const d = typeof query.day === 'string' ? query.day.trim() : '';
    const range = d ? kstDayRangeYmd(d) : kstDayRangeYmd(kstTodayYmd());
    if (!range) return kstLast3MonthsRange();
    return range;
  }
  return kstLast3MonthsRange();
}
