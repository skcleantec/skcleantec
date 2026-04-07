import { prisma } from '../../lib/prisma.js';
import { notifyInboxRefresh } from './inboxNotify.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';

async function employedStaffIds(): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function teamLeaderIdsForInquiry(inquiryId: string): Promise<string[]> {
  const rows = await prisma.assignment.findMany({
    where: { inquiryId },
    select: { teamLeaderId: true },
  });
  return [...new Set(rows.map((r) => r.teamLeaderId))];
}

/**
 * C/S 신규·상태 변경 시 GNB 배지(관리자 미처리 건수·팀장 담당 건수) 갱신용.
 * `inbox:refresh` 와 동일 채널로 보내 클라이언트가 GET /nav-badges 를 다시 호출하게 함.
 */
export async function notifyCsReportNavBadges(inquiryId: string | null | undefined): Promise<void> {
  const staff = await employedStaffIds();
  const id = inquiryId ?? null;
  const leaders = id ? await teamLeaderIdsForInquiry(id) : [];
  notifyInboxRefresh([...staff, ...leaders]);
}
