import type { Prisma, PrismaClient } from '@prisma/client';

type AssignmentDb = Prisma.TransactionClient | PrismaClient;

/**
 * 자사 팀장·관리자(미리보기) 배정만 제거한다. EXTERNAL_PARTNER 배정은 유지.
 * @returns 제거된 teamLeader user id (중복 제거)
 */
export async function clearInternalInquiryAssignments(
  db: AssignmentDb,
  tenantId: string,
  inquiryId: string,
): Promise<string[]> {
  const rows = await db.assignment.findMany({
    where: {
      tenantId,
      inquiryId,
      teamLeader: { role: { in: ['TEAM_LEADER', 'ADMIN'] } },
    },
    select: { id: true, teamLeaderId: true },
  });
  if (rows.length === 0) return [];

  await db.assignment.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });

  return [...new Set(rows.map((r) => r.teamLeaderId))];
}
