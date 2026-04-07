import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Date → KST 달력 yyyy-mm-dd */
export function dateToYmdKst(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export { kstTodayYmd };

/**
 * 입사일 포함, 퇴사일 미포함.
 * - hireDate 없음: 과거 제한 없음
 * - resignationDate 없음: 퇴사 없음
 */
export function isUserEmployedOnYmd(
  hireDate: Date | null,
  resignationDate: Date | null,
  ymd: string
): boolean {
  if (!YMD.test(ymd)) return false;
  if (hireDate) {
    const h = dateToYmdKst(hireDate);
    if (ymd < h) return false;
  }
  if (resignationDate) {
    const r = dateToYmdKst(resignationDate);
    if (ymd >= r) return false;
  }
  return true;
}

function ymdMinusOneDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  d.setDate(d.getDate() - 1);
  return dateToYmdKst(d);
}

/** 해당 월(KST) 중 하루라도 근무했으면 true — 통계용 */
export function employmentOverlapsMonthKst(
  hireDate: Date | null,
  resignationDate: Date | null,
  monthStartYmd: string,
  monthEndYmd: string
): boolean {
  const firstYmd = hireDate ? dateToYmdKst(hireDate) : '1970-01-01';
  let lastYmd = '9999-12-31';
  if (resignationDate) {
    const r = dateToYmdKst(resignationDate);
    lastYmd = ymdMinusOneDay(r);
  }
  return firstYmd <= monthEndYmd && lastYmd >= monthStartYmd;
}

/** yyyy-mm-dd 문자열 → Date @db.Date 저장용 (정오 KST) */
export function parseYmdToUtcDate(ymd: string): Date | null {
  if (!YMD.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00+09:00`);
}

export function serializeUserDates(u: {
  hireDate: Date | null;
  resignationDate: Date | null;
}): { hireDate: string | null; resignationDate: string | null } {
  return {
    hireDate: u.hireDate ? dateToYmdKst(u.hireDate) : null,
    resignationDate: u.resignationDate ? dateToYmdKst(u.resignationDate) : null,
  };
}
