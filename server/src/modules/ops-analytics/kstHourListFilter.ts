/** KST 시간·기간 list drill-down 쿼리 파싱 */

import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';

export function parseKstHourQuery(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 23) return undefined;
  return n;
}

export function parseYmdQuery(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

export function kstYmdRange(fromYmd: string, toYmd: string): { gte: Date; lte: Date } | null {
  if (fromYmd > toYmd) return null;
  return {
    gte: new Date(`${fromYmd}T00:00:00+09:00`),
    lte: new Date(`${toYmd}T23:59:59.999+09:00`),
  };
}

export type ListDateQuery = {
  datePreset?: string;
  month?: string;
  day?: string;
  fromYmd?: string;
  toYmd?: string;
};

/** fromYmd+toYmd 우선, 없으면 datePreset */
export function createdAtRangeFromListQuery(query: ListDateQuery): { gte: Date; lte: Date } | null {
  const from = parseYmdQuery(query.fromYmd);
  const to = parseYmdQuery(query.toYmd);
  if (from && to) {
    return kstYmdRange(from, to);
  }
  return createdAtRangeFromQuery({
    datePreset: query.datePreset,
    month: query.month,
    day: query.day,
  });
}
