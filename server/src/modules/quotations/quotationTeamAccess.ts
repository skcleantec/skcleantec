import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/** 담당 팀장 배정 접수인지 확인 */
export async function isInquiryAssignedToTeamLeader(
  tenantId: string,
  inquiryId: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.inquiry.findFirst({
    where: {
      id: inquiryId,
      tenantId,
      assignments: { some: { teamLeaderId: userId } },
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** 팀장이 볼 수 있는 견적 — 배정 접수에 연결된 건만 */
export function teamQuotationListWhere(
  tenantId: string,
  userId: string,
): Prisma.QuotationWhereInput {
  return {
    tenantId,
    inquiryId: { not: null },
    inquiry: {
      assignments: { some: { teamLeaderId: userId } },
    },
  };
}

export async function findQuotationForTeamLeader(
  tenantId: string,
  quotationId: string,
  userId: string,
) {
  return prisma.quotation.findFirst({
    where: {
      id: quotationId,
      ...teamQuotationListWhere(tenantId, userId),
    },
  });
}
