import {
  createdAtRangeFromQuery,
  kstMonthRangeYm,
  kstTodayYmd,
  type DatePreset,
} from '../inquiries/inquiryListDateRange.js';

const ALL_FROM_YMD = '2020-01-01';

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
      gte: new Date(`${loYmd}T00:00:00+09:00`),
      lte: new Date(`${hiYmd}T23:59:59.999+09:00`),
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
      gte: new Date(`${loYmd}T00:00:00+09:00`),
      lte: new Date(`${hiYmd}T23:59:59.999+09:00`),
    };
  }

  const loYmd = range.gte.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const hiYmd = range.lte.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  return { loYmd, hiYmd, gte: range.gte, lte: range.lte };
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
