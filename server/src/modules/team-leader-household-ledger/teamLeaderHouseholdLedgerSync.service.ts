import type { PrismaClient } from '@prisma/client';
import {
  applyHouseholdLedgerPrefillForInquiryLeader,
  inquiryHouseholdPrefillSelect,
} from './teamLeaderHouseholdLedgerAutoSync.service.js';
import { getEffectiveEnabledModules } from '../tenants/tenantFeatures.service.js';
import { isSoloOperatorTenant } from '../../lib/soloOperator.js';
import { resolveFieldOwnerIds } from '../../lib/fieldOwner.js';

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
  const subject = await db.user.findFirst({
    where: { id: opts.teamLeaderId, tenantId: opts.tenantId, isActive: true },
    select: { role: true },
  });
  const enabled = subject?.role === 'ADMIN' ? await getEffectiveEnabledModules(opts.tenantId) : null;
  const soloAdmin = subject?.role === 'ADMIN' && isSoloOperatorTenant(enabled);

  const assignments = soloAdmin
    ? await db.inquiry.findMany({
        where: { tenantId: opts.tenantId, deletedAt: null, assignments: { none: {} } },
        select: { id: true },
      })
    : await db.assignment.findMany({
        where: {
          tenantId: opts.tenantId,
          teamLeaderId: opts.teamLeaderId,
          teamLeader: { role: 'TEAM_LEADER', tenantId: opts.tenantId },
          inquiry: { deletedAt: null },
        },
        select: { inquiryId: true },
        distinct: ['inquiryId'],
      });

  const inquiryIds = soloAdmin
    ? (assignments as { id: string }[]).map((row) => row.id)
    : (assignments as { inquiryId: string }[]).map((row) => row.inquiryId);

  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const inquiryId of inquiryIds) {
    if (soloAdmin) {
      const owners = await resolveFieldOwnerIds(opts.tenantId, inquiryId);
      if (!owners.includes(opts.teamLeaderId)) continue;
    }
    const r = await applyHouseholdLedgerPrefillForInquiryLeader(db, {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      inquiryId,
    });
    created += r.created;
    updated += r.updated;
    removed += r.removed;
  }

  return {
    inquiryCount: inquiryIds.length,
    created,
    updated,
    removed,
  };
}

export { inquiryHouseholdPrefillSelect };
