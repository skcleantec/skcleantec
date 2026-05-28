/** 접수 목록 — 접수일(createdAt) 기준, 한국 시간(Asia/Seoul) 하루·한 달 구간 */

export type DatePreset = 'today' | 'all' | 'month' | 'day';

/** 오늘 날짜 YYYY-MM-DD (KST) */
export function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** KST 달력 YYYY-MM-DD에 일 수를 더함 */
export function addDaysToKstYmd(ymd: string, deltaDays: number): string {
  const t = new Date(`${ymd}T12:00:00+09:00`).getTime() + deltaDays * 86400000;
  return new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** startYmd ~ endYmd 포함, KST 달력 키 나열 */
export function kstYmdKeysInRange(startYmd: string, endYmd: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return [];
  if (startYmd > endYmd) return [];
  const out: string[] = [];
  let cur = startYmd;
  for (;;) {
    out.push(cur);
    if (cur === endYmd) break;
    cur = addDaysToKstYmd(cur, 1);
  }
  return out;
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

/**
 * 부재현황 `preferredMoveInCleaningDate`(YYYY-MM-DD) 문자열 필드 구간.
 * ISO 날짜 문자열은 사전순이 곧 달력순이라 `gte`/`lte`로 월·일 범위를 줄 수 있다.
 */
export function preferredMoveInYmdRangeFromQuery(query: {
  preferredDatePreset?: string;
  preferredMonth?: string;
  preferredDay?: string;
}): { gte: string; lte: string } | null {
  const preset = query.preferredDatePreset as DatePreset | undefined;
  if (!preset || preset === 'all') return null;
  if (preset === 'today') {
    const d = kstTodayYmd();
    return { gte: d, lte: d };
  }
  if (preset === 'month') {
    const mk = typeof query.preferredMonth === 'string' ? query.preferredMonth.trim() : '';
    const m = /^(\d{4})-(\d{2})$/.exec(mk);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    const lastDay = new Date(y, mo, 0).getDate();
    const gte = `${y}-${String(mo).padStart(2, '0')}-01`;
    const lte = `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { gte, lte };
  }
  if (preset === 'day') {
    const d = typeof query.preferredDay === 'string' ? query.preferredDay.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    return { gte: d, lte: d };
  }
  return null;
}
