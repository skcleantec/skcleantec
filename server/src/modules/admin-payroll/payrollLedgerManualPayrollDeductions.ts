import type { PrismaClient } from '@prisma/client';
import {
  PayrollAccountLedgerManualDirection,
  PayrollLedgerManualPayrollLinkKind,
} from '@prisma/client';

/**
 * 귀속 월·수기 장부 지출·POOL_MEMBER 연결만 집계 — 풀 팀원 `amountNet` 선차감용.
 */
export async function sumLedgerManualPoolMemberDeductionsByMonth(
  prisma: PrismaClient,
  monthKey: string,
  teamMemberIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (teamMemberIds.length === 0) return map;

  const grouped = await prisma.payrollAccountLedgerManualEntry.groupBy({
    by: ['linkTeamMemberId'],
    where: {
      monthKey,
      direction: PayrollAccountLedgerManualDirection.OUT,
      payrollLinkKind: PayrollLedgerManualPayrollLinkKind.POOL_MEMBER,
      linkTeamMemberId: { in: teamMemberIds },
    },
    _sum: { amount: true },
  });

  for (const row of grouped) {
    if (row.linkTeamMemberId == null) continue;
    map.set(row.linkTeamMemberId, row._sum.amount ?? 0);
  }
  return map;
}
