import {
  createdAtRangeFromQuery,
  kstMonthRangeYm,
  kstTodayYmd,
  type DatePreset,
} from '../inquiries/inquiryListDateRange.js';

const SETTLEMENT_ALL_FROM_YMD = '2020-01-01';

export function settlementPreferredRangeFromQuery(query: {
  datePreset?: string;
  month?: string;
  day?: string;
  from?: string;
  to?: string;
}): { from: Date; to: Date; loYmd: string; hiYmd: string } {
  const fromRaw = typeof query.from === 'string' ? query.from.trim() : '';
  const toRaw = typeof query.to === 'string' ? query.to.trim() : '';
  if (
    fromRaw &&
    toRaw &&
    /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toRaw) &&
    !query.datePreset
  ) {
    const loYmd = fromRaw <= toRaw ? fromRaw : toRaw;
    const hiYmd = fromRaw <= toRaw ? toRaw : fromRaw;
    return {
      loYmd,
      hiYmd,
      from: new Date(`${loYmd}T00:00:00+09:00`),
      to: new Date(`${hiYmd}T23:59:59.999+09:00`),
    };
  }

  const preset = (typeof query.datePreset === 'string' ? query.datePreset : 'month') as DatePreset;
  if (preset === 'all') {
    const loYmd = SETTLEMENT_ALL_FROM_YMD;
    const hiYmd = kstTodayYmd();
    return {
      loYmd,
      hiYmd,
      from: new Date(`${loYmd}T00:00:00+09:00`),
      to: new Date(`${hiYmd}T23:59:59.999+09:00`),
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
    const loYmd = SETTLEMENT_ALL_FROM_YMD;
    const hiYmd = kstTodayYmd();
    return {
      loYmd,
      hiYmd,
      from: new Date(`${loYmd}T00:00:00+09:00`),
      to: new Date(`${hiYmd}T23:59:59.999+09:00`),
    };
  }

  const loYmd = range.gte.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const hiYmd = range.lte.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  return { from: range.gte, to: range.lte, loYmd, hiYmd };
}

export function parseSettlementListPaging(query: Record<string, unknown>): {
  itemsLimit: number;
  itemsOffset: number;
  payLimit: number;
  payOffset: number;
} {
  const parsePosInt = (raw: unknown, fallback: number, max: number) => {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(max, Math.floor(n));
  };
  const parseOffset = (raw: unknown) => {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };
  return {
    itemsLimit: parsePosInt(query.limit, 30, 100),
    itemsOffset: parseOffset(query.offset),
    payLimit: parsePosInt(query.payLimit, 30, 100),
    payOffset: parseOffset(query.payOffset),
  };
}
