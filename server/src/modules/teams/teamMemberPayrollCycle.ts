import { parseCrewMemberNoteToNames } from '../inquiries/crewMemberNoteCompare.js';
import { dateToYmdKst } from '../users/userEmployment.js';

/** 해당 월의 지급일 ymd (일자가 월 말을 넘으면 말일로 클램프). monthIndex 0-based */
function payYmdInMonth(year: number, monthIndex: number, payDay: number): string {
  const last = new Date(year, monthIndex + 1, 0).getDate();
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
  const [ty, tm, _td] = todayYmd.split('-').map(Number);
  const monthIndex = tm - 1;

  const thisMonthPayYmd = payYmdInMonth(ty, monthIndex, monthlyPayDay);
  const todayNoon = new Date(`${todayYmd}T12:00:00+09:00`).getTime();
  const thisPayNoon = new Date(`${thisMonthPayYmd}T12:00:00+09:00`).getTime();

  if (todayNoon >= thisPayNoon) {
    const startYmd = thisMonthPayYmd;
    const nextMonthFirst = new Date(ty, monthIndex + 1, 1);
    const ny = nextMonthFirst.getFullYear();
    const nm = nextMonthFirst.getMonth();
    const nextPayYmd = payYmdInMonth(ny, nm, monthlyPayDay);
    const endStamp = new Date(`${nextPayYmd}T12:00:00+09:00`).getTime() - 86400000;
    const endYmd = dateToYmdKst(new Date(endStamp));
    return { startYmd, endYmd };
  }

  const prevMonthLast = new Date(ty, monthIndex, 0);
  const py = prevMonthLast.getFullYear();
  const pm = prevMonthLast.getMonth();
  const startYmd = payYmdInMonth(py, pm, monthlyPayDay);
  const endStamp = new Date(`${thisMonthPayYmd}T12:00:00+09:00`).getTime() - 86400000;
  const endYmd = dateToYmdKst(new Date(endStamp));
  return { startYmd, endYmd };
}

export function payrollCyclePreferredDateWhere(startYmd: string, endYmd: string): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${startYmd}T00:00:00.000+09:00`),
    lte: new Date(`${endYmd}T23:59:59.999+09:00`),
  };
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
