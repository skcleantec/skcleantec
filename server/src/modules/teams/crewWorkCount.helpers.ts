import type { PrismaClient } from '@prisma/client';
import {
  DEFAULT_CREW_WORK_COUNT_MODE,
  type CrewWorkCountMode,
} from '../../lib/crewGroupSettings.js';
import {
  countMatchedWorkUnits,
  type PayrollCycleInquiryRow,
  type PayrollCycleMemberRef,
} from './teamMemberPayrollCycle.js';

export { countMatchedWorkUnits };
export type { PayrollCycleInquiryRow, PayrollCycleMemberRef };

/** 팀원 → 소속 크루 그룹 집계 방식 (미소속·그룹 없음 → DISTINCT_DAY) */
export async function loadWorkCountModeByMemberId(
  prisma: PrismaClient,
  tenantId: string,
  memberIds: readonly string[],
): Promise<Map<string, CrewWorkCountMode>> {
  const out = new Map<string, CrewWorkCountMode>();
  if (memberIds.length === 0) return out;

  const rows = await prisma.teamCrewGroupMember.findMany({
    where: {
      teamMemberId: { in: [...memberIds] },
      group: { tenantId },
    },
    select: {
      teamMemberId: true,
      group: { select: { workCountMode: true } },
    },
  });

  for (const row of rows) {
    out.set(row.teamMemberId, row.group.workCountMode);
  }
  for (const id of memberIds) {
    if (!out.has(id)) out.set(id, DEFAULT_CREW_WORK_COUNT_MODE);
  }
  return out;
}

export async function loadWorkCountModeForGroup(
  prisma: PrismaClient,
  groupId: string,
): Promise<CrewWorkCountMode> {
  const group = await prisma.teamCrewGroup.findUnique({
    where: { id: groupId },
    select: { workCountMode: true },
  });
  return group?.workCountMode ?? DEFAULT_CREW_WORK_COUNT_MODE;
}
