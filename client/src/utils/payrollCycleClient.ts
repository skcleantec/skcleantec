const PAY_YMD = /^\d{4}-\d{2}-\d{2}$/;
const PAY_YM = /^\d{4}-\d{2}$/;

export function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function kstMonthKeyNow(): string {
  return kstTodayYmd().slice(0, 7);
}

export function parsePayAsOfYmd(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const ymd = raw.trim();
  if (!PAY_YMD.test(ymd)) return null;
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > last) return null;
  return ymd;
}

export function parsePayYmdRange(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): { fromYmd: string; toYmd: string } | null {
  const from = parsePayAsOfYmd(fromRaw);
  const to = parsePayAsOfYmd(toRaw);
  if (!from || !to) return null;
  return from <= to ? { fromYmd: from, toYmd: to } : { fromYmd: to, toYmd: from };
}

/** 귀속월(YYYY-MM)의 1일~말일 */
export function kstMonthBoundsYmd(monthKey: string): { fromYmd: string; toYmd: string } | null {
  const ym = parsePayMonthKey(monthKey);
  if (!ym) return null;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    fromYmd: `${ym}-01`,
    toYmd: `${ym}-${String(last).padStart(2, '0')}`,
  };
}

export function parsePayMonthKey(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const ym = raw.trim();
  if (!PAY_YM.test(ym)) return null;
  const m = Number(ym.slice(5, 7));
  if (m < 1 || m > 12) return null;
  return ym;
}

/** 급여 지급일 ymd 기준 이전/다음 주기 지급일 (서버 teamMemberPayrollCycle과 동일) */
export function shiftPayrollCyclePayYmd(
  payYmd: string,
  monthlyPayDay: number,
  deltaMonths: number,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payYmd)) return null;
  const y = parseInt(payYmd.slice(0, 4), 10);
  const m = parseInt(payYmd.slice(5, 7), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  let monthIndex = m - 1 + deltaMonths;
  let year = y;
  while (monthIndex > 11) {
    monthIndex -= 12;
    year += 1;
  }
  while (monthIndex < 0) {
    monthIndex += 12;
    year -= 1;
  }
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const d = Math.min(Math.max(1, monthlyPayDay), last);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function formatYmdDot(ymd: string): string {
  return ymd.replace(/-/g, '.');
}
