/** 해피콜 마감(작업일 전날 KST 말일) — 서버 happyCall.helpers 와 동일 규칙 */

function kstYmdFromDate(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function addDaysToYmdKst(ymd: string, delta: number): string {
  const t = new Date(`${ymd}T12:00:00+09:00`);
  t.setDate(t.getDate() + delta);
  return t.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function kstDayRangeYmd(ymd: string): { lte: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const lte = new Date(`${ymd}T23:59:59.999+09:00`);
  if (Number.isNaN(lte.getTime())) return null;
  return { lte };
}

export function happyCallDeadlineEnd(preferredDate: Date): Date {
  const workYmd = kstYmdFromDate(preferredDate);
  const prevYmd = addDaysToYmdKst(workYmd, -1);
  const r = kstDayRangeYmd(prevYmd);
  if (!r) return new Date(0);
  return r.lte;
}

const BLOCK = new Set(['CANCELLED', 'PENDING']);

export function isHappyCallEligible(status: string, preferredDate: string | null | undefined): boolean {
  if (!preferredDate) return false;
  if (BLOCK.has(status)) return false;
  return true;
}

/** 접수 목록 행 강조: overdue | pending | none */
export function happyCallRowTone(
  now: Date,
  status: string,
  preferredDate: string | null | undefined,
  happyCallCompletedAt: string | null | undefined,
  hasAssignment: boolean
): 'overdue' | 'pending' | 'none' {
  if (!hasAssignment || !isHappyCallEligible(status, preferredDate)) return 'none';
  if (happyCallCompletedAt) return 'none';
  const pd = preferredDate ? new Date(preferredDate) : null;
  if (!pd) return 'none';
  if (now > happyCallDeadlineEnd(pd)) return 'overdue';
  return 'pending';
}
