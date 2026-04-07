import type { PrismaClient } from '@prisma/client';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';

/** 기간 내 달력 일수 (양 끝 포함), 최소 1 */
export function inclusiveDayCount(fromYmd: string, toYmd: string): number {
  const a = new Date(fromYmd + 'T00:00:00.000Z');
  const b = new Date(toYmd + 'T00:00:00.000Z');
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

export function parseRange(from?: string, to?: string): { from: Date; to: Date; fromYmd: string; toYmd: string } | null {
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return null;
  }
  const fromD = new Date(from + 'T00:00:00.000Z');
  const toD = new Date(to + 'T23:59:59.999Z');
  if (fromD > toD) return null;
  return { from: fromD, to: toD, fromYmd: from, toYmd: to };
}

/** 관리자: 전체 마케터 또는 쿼리의 marketerId. 마케터: 본인만 */
export function resolveMarketerScope(
  user: AuthPayload,
  queryMarketerId: string | undefined
): { marketerIds: string[] | 'ALL_MARKETERS' } {
  if (user.role === 'ADMIN') {
    if (queryMarketerId && queryMarketerId.trim()) {
      return { marketerIds: [queryMarketerId.trim()] };
    }
    return { marketerIds: 'ALL_MARKETERS' };
  }
  return { marketerIds: [user.userId] };
}

export async function loadMarketerUsers(
  prisma: PrismaClient,
  scope: { marketerIds: string[] | 'ALL_MARKETERS' }
): Promise<{ id: string; name: string; email: string }[]> {
  const ymd = kstTodayYmd();
  if (scope.marketerIds === 'ALL_MARKETERS') {
    const rows = await prisma.user.findMany({
      where: { role: 'MARKETER', isActive: true },
      select: { id: true, name: true, email: true, hireDate: true, resignationDate: true },
      orderBy: { name: 'asc' },
    });
    return rows
      .filter((r) => isUserEmployedOnYmd(r.hireDate, r.resignationDate, ymd))
      .map(({ id, name, email }) => ({ id, name, email }));
  }
  const rows = await prisma.user.findMany({
    where: { id: { in: scope.marketerIds }, role: 'MARKETER', isActive: true },
    select: { id: true, name: true, email: true, hireDate: true, resignationDate: true },
    orderBy: { name: 'asc' },
  });
  return rows
    .filter((r) => isUserEmployedOnYmd(r.hireDate, r.resignationDate, ymd))
    .map(({ id, name, email }) => ({ id, name, email }));
}

export function sumSpendFromSessions(
  sessions: { spendLines: { amount: number }[] }[]
): number {
  let t = 0;
  for (const s of sessions) {
    for (const l of s.spendLines) t += l.amount;
  }
  return t;
}
