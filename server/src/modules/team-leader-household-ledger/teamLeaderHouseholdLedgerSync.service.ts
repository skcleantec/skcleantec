import type { PrismaClient } from '@prisma/client';
import {
  applyHouseholdLedgerPrefillForInquiryLeader,
  inquiryHouseholdPrefillSelect,
} from './teamLeaderHouseholdLedgerAutoSync.service.js';

export type HouseholdLedgerSyncResult = {
  inquiryCount: number;
  created: number;
  updated: number;
  removed: number;
};

export async function syncHouseholdLedgerFromAssignments(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string },
): Promise<HouseholdLedgerSyncResult> {
  const assignments = await db.assignment.findMany({
    where: {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      teamLeader: { role: 'TEAM_LEADER', tenantId: opts.tenantId },
      inquiry: { deletedAt: null },
    },
    select: { inquiryId: true },
    distinct: ['inquiryId'],
  });

  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const row of assignments) {
    const r = await applyHouseholdLedgerPrefillForInquiryLeader(db, {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      inquiryId: row.inquiryId,
    });
    created += r.created;
    updated += r.updated;
    removed += r.removed;
  }

  return {
    inquiryCount: assignments.length,
    created,
    updated,
    removed,
  };
}

export { inquiryHouseholdPrefillSelect };
