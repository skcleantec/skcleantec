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
