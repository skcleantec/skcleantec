import type { PrismaClient } from '@prisma/client';
import { crewMemberNoteIncludesTeamMember } from './teamMemberPayrollCycle.js';
import { dateToYmdKst } from '../users/userEmployment.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const IGNORE_STATUS = ['CANCELLED', 'ON_HOLD'] as const;

/** KST 문자열 두 날짜의 순수 일수 차이 (to − from). 같은 날이면 0 */
export function kstCalendarDayDiffDays(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00+09:00`).getTime();
  const b = new Date(`${toYmd}T12:00:00+09:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * 팀장별·풀 팀원 이름마다 해당 팀장과 같이 간 접수 예약일이 `currentYmd`(KST, 포함)까지의 범위에서
 * 가장 마지막이었던 날로부터 `currentYmd`까지 며칠이 지났는지(날짜 차이).
 * 과거 같은 조합 접수가 없으면 해당 이름은 값이 null (클라이언트는 배지 생략).
 */
export async function computeCrewSpacingByPoolMemberName(
  prisma: PrismaClient,
  opts: {
    teamLeaderId: string;
    currentYmd: string;
    poolMembers: readonly { name: string; nameTh: string | null }[];
  }
): Promise<Record<string, number | null>> {
  const leader = await prisma.user.findUnique({
    where: { id: opts.teamLeaderId },
    select: { role: true },
  });
  const out: Record<string, number | null> = {};
  if (!leader || leader.role === 'EXTERNAL_PARTNER') {
    for (const m of opts.poolMembers) {
      out[m.name] = null;
    }
    return out;
  }

  if (!YMD.test(opts.currentYmd)) {
    for (const m of opts.poolMembers) {
      out[m.name] = null;
    }
    return out;
  }

  const lte = new Date(`${opts.currentYmd}T23:59:59.999+09:00`);

  const rows = await prisma.inquiry.findMany({
    where: {
      assignments: { some: { teamLeaderId: opts.teamLeaderId } },
      preferredDate: { not: null, lte },
      status: { notIn: [...IGNORE_STATUS] },
    },
    select: {
      preferredDate: true,
      crewMemberNote: true,
    },
  });

  for (const m of opts.poolMembers) {
    let lastYmd: string | null = null;
    for (const r of rows) {
      if (!r.preferredDate) continue;
      if (!crewMemberNoteIncludesTeamMember(r.crewMemberNote, m)) continue;
      const ymd = dateToYmdKst(r.preferredDate);
      if (!lastYmd || ymd > lastYmd) lastYmd = ymd;
    }
    out[m.name] = lastYmd == null ? null : kstCalendarDayDiffDays(lastYmd, opts.currentYmd);
  }

  return out;
}
