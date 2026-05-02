import { parseCrewMemberNoteToNames } from '../inquiries/crewMemberNoteCompare.js';
import { dateToYmdKst } from '../users/userEmployment.js';

/** 그레고리력 월 길이 (서버 TZ와 무관). monthIndex 0-based */
function daysInGregorianMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** 해당 월의 지급일 ymd (일자가 월 말을 넘으면 말일로 클램프). monthIndex 0-based · 순수 달력 */
export function payYmdInMonth(year: number, monthIndex: number, payDay: number): string {
  const last = daysInGregorianMonth(year, monthIndex);
  const d = Math.min(Math.max(1, payDay), last);
  const m = monthIndex + 1;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * 월급일(KST 달력 `monthlyPayDay`) 기준 급여 주기 — 시작일·종료일 포함.
 * 「이번 월급일 ~ 다음 월급일 전날」 중 오늘(KST)이 속하는 구간.
 */
export function payrollCycleBoundsKst(monthlyPayDay: number): { startYmd: string; endYmd: string } {
  const todayYmd = dateToYmdKst(new Date());
  const ty = parseInt(todayYmd.slice(0, 4), 10);
  const tm = parseInt(todayYmd.slice(5, 7), 10);
  const monthIndex = tm - 1;

  const thisMonthPayYmd = payYmdInMonth(ty, monthIndex, monthlyPayDay);
  const todayNoon = new Date(`${todayYmd}T12:00:00+09:00`).getTime();
  const thisPayNoon = new Date(`${thisMonthPayYmd}T12:00:00+09:00`).getTime();

  if (todayNoon >= thisPayNoon) {
    const startYmd = thisMonthPayYmd;
    let ny = ty;
    let nm = tm + 1;
    if (nm > 12) {
      nm = 1;
      ny += 1;
    }
    const nextPayYmd = payYmdInMonth(ny, nm - 1, monthlyPayDay);
    const endYmd = dateToYmdKst(new Date(new Date(`${nextPayYmd}T12:00:00+09:00`).getTime() - 86400000));
    return { startYmd, endYmd };
  }

  let py = ty;
  let pm = tm - 1;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  const startYmd = payYmdInMonth(py, pm - 1, monthlyPayDay);
  const endYmd = dateToYmdKst(new Date(new Date(`${thisMonthPayYmd}T12:00:00+09:00`).getTime() - 86400000));
  return { startYmd, endYmd };
}

export function payrollCyclePreferredDateWhere(startYmd: string, endYmd: string): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${startYmd}T00:00:00.000+09:00`),
    lte: new Date(`${endYmd}T23:59:59.999+09:00`),
  };
}

/**
 * 특정 지급일(`payYmd`)에 지급되는 급여에 대응하는 근무·산정 구간 (양 끝 포함).
 * `monthlyPayDay`: 팀원 설정의 월급일(1~31). 지급일이 말일로 클램프돼 있어도 전월 구간 시작은 이 값으로 맞춘다.
 * 예: 월급일 11 → 전월 11일 ~ 당월 10일 (지급이 당월 11일인 경우)
 */
export function payrollAccrualPeriodForPaymentDate(
  payYmd: string,
  monthlyPayDay: number,
): { startYmd: string; endYmd: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payYmd)) return null;
  const pd = Math.floor(monthlyPayDay);
  if (pd < 1 || pd > 31) return null;

  const payNoonKst = new Date(`${payYmd}T12:00:00+09:00`);
  if (Number.isNaN(payNoonKst.getTime())) return null;
  const endYmd = dateToYmdKst(new Date(payNoonKst.getTime() - 86400000));

  const y = parseInt(payYmd.slice(0, 4), 10);
  const m = parseInt(payYmd.slice(5, 7), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;

  let prevY = y;
  let prevM = m - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY -= 1;
  }
  const startYmd = payYmdInMonth(prevY, prevM - 1, pd);
  return { startYmd, endYmd };
}

/** 크루 현장 일정과 동일: 메모 토큰이 팀원 이름 또는 태국어 표시명과 정확히 일치 */
export function crewMemberNoteIncludesTeamMember(
  note: string | null | undefined,
  member: { name: string; nameTh: string | null },
): boolean {
  const tokens = parseCrewMemberNoteToNames(note);
  const ko = member.name.trim();
  const th = (member.nameTh ?? '').trim();
  return tokens.some((t) => t === ko || (th.length > 0 && t === th));
}

/**
 * 현장 팀원 월급 산정: 같은 날(KST 예약일)에 현장을 여러 번 나가도 **1일 1회**만 인정.
 * 금액 = 근무일 수 × 일당.
 */
export function distinctPayrollDaysForPoolMember(
  inquiries: { crewMemberNote: string | null; preferredDate: Date | null }[],
  member: { name: string; nameTh: string | null },
): number {
  const days = new Set<string>();
  for (const inq of inquiries) {
    if (!crewMemberNoteIncludesTeamMember(inq.crewMemberNote, member)) continue;
    if (inq.preferredDate == null) continue;
    days.add(dateToYmdKst(inq.preferredDate));
  }
  return days.size;
}
