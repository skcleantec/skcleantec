import {
  createdAtRangeFromQuery,
  kstMonthRangeYm,
  kstTodayYmd,
  type DatePreset,
} from '../inquiries/inquiryListDateRange.js';

const ALL_FROM_YMD = '2020-01-01';

/**
 * `occurredOn`은 `@db.Date`. KST 자정(`T00:00:00+09:00`)을 그대로 넘기면
 * UTC 세션에서 전날(예: 9월 1일 → 8월 31일)로 잘려 월 필터에 전월 말일이 섞인다.
 * 달력 날짜는 UTC 자정으로 비교한다.
 */
function calendarYmdToDbDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function householdLedgerRangeFromQuery(query: {
  datePreset?: string;
  month?: string;
  day?: string;
}): { loYmd: string; hiYmd: string; gte: Date; lte: Date } {
  const preset = (typeof query.datePreset === 'string' ? query.datePreset : 'all') as DatePreset;
  if (preset === 'all') {
    const loYmd = ALL_FROM_YMD;
    const hiYmd = kstTodayYmd();
    return {
      loYmd,
      hiYmd,
      gte: calendarYmdToDbDate(loYmd),
      lte: calendarYmdToDbDate(hiYmd),
    };
  }

  let range = createdAtRangeFromQuery({
    datePreset: preset,
    month: typeof query.month === 'string' ? query.month : undefined,
    day: typeof query.day === 'string' ? query.day : undefined,
  });
  if (!range && preset === 'month') {
    range = kstMonthRangeYm(kstTodayYmd().slice(0, 7));
  }
  if (!range) {
    const loYmd = ALL_FROM_YMD;
    const hiYmd = kstTodayYmd();
    return {
      loYmd,
      hiYmd,
      gte: calendarYmdToDbDate(loYmd),
      lte: calendarYmdToDbDate(hiYmd),
    };
  }

  const loYmd = range.gte.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const hiYmd = range.lte.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  return {
    loYmd,
    hiYmd,
    gte: calendarYmdToDbDate(loYmd),
    lte: calendarYmdToDbDate(hiYmd),
  };
}

export function parseHouseholdLedgerPaging(query: Record<string, unknown>): {
  limit: number;
  offset: number;
} {
  const parsePosInt = (raw: unknown, fallback: number, max: number) => {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(n, max);
  };
  const limit = parsePosInt(query.limit, 30, 100);
  const page = parsePosInt(query.page, 1, 10_000);
  return { limit, offset: (page - 1) * limit };
}

export function parseOccurredOnYmd(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  return new Date(`${raw.trim()}T12:00:00+09:00`);
}
