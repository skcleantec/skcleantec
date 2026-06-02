/** KST 오늘 YYYY-MM-DD — 서버 `userEmployment.kstTodayYmd` 와 동일 */
export function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 입사일 포함, 퇴사일 미포함 */
export function isUserEmployedOnYmd(
  hireDate: string | null | undefined,
  resignationDate: string | null | undefined,
  ymd: string
): boolean {
  if (!YMD.test(ymd)) return false;
  const h = hireDate?.trim() || null;
  const r = resignationDate?.trim() || null;
  if (h && ymd < h) return false;
  if (r && ymd >= r) return false;
  return true;
}

export function isResignedAsOfYmd(
  hireDate: string | null | undefined,
  resignationDate: string | null | undefined,
  ymd: string = kstTodayYmd()
): boolean {
  if (!resignationDate?.trim()) return false;
  return !isUserEmployedOnYmd(hireDate, resignationDate, ymd);
}

export type EmploymentStatusFilter = 'active' | 'resigned' | 'all';

export function filterByEmploymentStatus<
  T extends { hireDate?: string | null; resignationDate?: string | null },
>(users: T[], status: EmploymentStatusFilter, ymd: string = kstTodayYmd()): T[] {
  if (status === 'all') return users;
  if (status === 'active') {
    return users.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, ymd));
  }
  return users.filter((u) => isResignedAsOfYmd(u.hireDate, u.resignationDate, ymd));
}
