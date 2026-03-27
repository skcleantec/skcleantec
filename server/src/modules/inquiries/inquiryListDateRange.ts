/** 접수 목록 — 접수일(createdAt) 기준, 한국 시간(Asia/Seoul) 하루·한 달 구간 */

export type DatePreset = 'today' | 'all' | 'month' | 'day';

/** 오늘 날짜 YYYY-MM-DD (KST) */
export function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function kstDayRangeYmd(ymd: string): { gte: Date; lte: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const gte = new Date(`${ymd}T00:00:00+09:00`);
  const lte = new Date(`${ymd}T23:59:59.999+09:00`);
  if (Number.isNaN(gte.getTime())) return null;
  return { gte, lte };
}

/** monthKey YYYY-MM → 해당 달 1일 00:00 ~ 말일 23:59 KST */
export function kstMonthRangeYm(monthKey: string): { gte: Date; lte: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const lastDay = new Date(y, mo, 0).getDate();
  const gte = new Date(`${y}-${String(mo).padStart(2, '0')}-01T00:00:00+09:00`);
  const lte = new Date(
    `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999+09:00`
  );
  if (Number.isNaN(gte.getTime())) return null;
  return { gte, lte };
}

export function createdAtRangeFromQuery(query: {
  datePreset?: string;
  month?: string;
  /** YYYY-MM-DD (KST 하루) — datePreset === 'day' 일 때 */
  day?: string;
}): { gte: Date; lte: Date } | null {
  const preset = query.datePreset as DatePreset | undefined;
  if (!preset || preset === 'all') return null;
  if (preset === 'today') {
    return kstDayRangeYmd(kstTodayYmd());
  }
  if (preset === 'month') {
    const mk = typeof query.month === 'string' ? query.month.trim() : '';
    if (!mk) return null;
    return kstMonthRangeYm(mk);
  }
  if (preset === 'day') {
    const d = typeof query.day === 'string' ? query.day.trim() : '';
    if (!d) return null;
    return kstDayRangeYmd(d);
  }
  return null;
}
