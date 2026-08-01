import type { PrismaClient } from '@prisma/client';
import { dateToYmdKst, isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import { inquiryActiveOnlyWhere } from '../inquiries/inquiryTrash.helpers.js';
import {
  assertInternalTeamAssignAllowed,
} from '../inquiries/inquiryHandedOffFromInternal.js';
import {
  assertTeamLeadersMatchInquiryBrand,
  OperatingCompanyAssignmentError,
} from '../operating-companies/operatingCompanyAssignment.js';
import {
  assertInquiryTeamLeaderAssignmentZones,
  ServiceZoneAssignmentError,
} from '../service-zones/serviceZoneAssignment.js';
import { notifyNewAssignmentForInquiry } from '../push/inquiryTeamWebPush.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';

export type QuickPasteSoloAssignPreview = {
  teamLeaderId: string;
  teamLeaderName: string;
};

async function resolveSoloTeamLeaderId(
  db: PrismaClient,
  tenantId: string,
  actorUserId: string,
): Promise<{ id: string; name: string } | null> {
  const leaders = await db.user.findMany({
    where: { tenantId, isActive: true, role: 'TEAM_LEADER' },
    select: {
      id: true,
      name: true,
      email: true,
      hireDate: true,
      resignationDate: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (leaders.length === 0) return null;
  if (leaders.length === 1) {
    return { id: leaders[0]!.id, name: leaders[0]!.name || leaders[0]!.email };
  }
  const self = leaders.find((l) => l.id === actorUserId);
  if (self) return { id: self.id, name: self.name || self.email };
  return null;
}

export async function previewQuickPasteSoloAutoAssign(
  db: PrismaClient,
  tenantId: string,
  actorUserId: string,
): Promise<QuickPasteSoloAssignPreview | null> {
  const assignmentsOn = await isFeatureEnabled(tenantId, 'core_assignments');
  if (!assignmentsOn) return null;
  const leader = await resolveSoloTeamLeaderId(db, tenantId, actorUserId);
  if (!leader) return null;
  return { teamLeaderId: leader.id, teamLeaderName: leader.name };
}

export async function tryQuickPasteSoloAutoAssign(opts: {
  db: PrismaClient;
  tenantId: string;
  inquiryId: string;
  assignedById: string;
}): Promise<QuickPasteSoloAssignPreview | null> {
  const { db, tenantId, inquiryId, assignedById } = opts;
  const assignmentsOn = await isFeatureEnabled(tenantId, 'core_assignments');
  if (!assignmentsOn) return null;

  const leader = await resolveSoloTeamLeaderId(db, tenantId, assignedById);
  if (!leader) return null;

  const inquiry = await db.inquiry.findFirst({
    where: { id: inquiryId, tenantId, ...inquiryActiveOnlyWhere() },
    select: { id: true, status: true, address: true, operatingCompanyId: true, preferredDate: true },
  });
  if (!inquiry || inquiry.status !== 'RECEIVED') return null;

  const teamLeader = await db.user.findFirst({
    where: { id: leader.id, tenantId, isActive: true, role: 'TEAM_LEADER' },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      hireDate: true,
      resignationDate: true,
    },
  });
  if (!teamLeader) return null;

  const assignYmd = inquiry.preferredDate
    ? dateToYmdKst(new Date(inquiry.preferredDate))
    : kstTodayYmd();
  if (!isUserEmployedOnYmd(teamLeader.hireDate, teamLeader.resignationDate, assignYmd)) {
    return null;
  }

  try {
    await assertInternalTeamAssignAllowed(db, tenantId, inquiry.id, [teamLeader.id]);
    await assertTeamLeadersMatchInquiryBrand({
      db,
      tenantId,
      inquiryOperatingCompanyId: inquiry.operatingCompanyId,
      assignees: [teamLeader],
    });
    await assertInquiryTeamLeaderAssignmentZones({
      db,
      tenantId,
      inquiryAddress: inquiry.address,
      inquiryId: inquiry.id,
      teamLeaderIds: [teamLeader.id],
      internalTeamLeaderIds: [teamLeader.id],
      assignmentServiceZoneId: null,
    });
  } catch (e) {
    if (e instanceof OperatingCompanyAssignmentError || e instanceof ServiceZoneAssignmentError) {
      return null;
    }
    throw e;
  }

  const existing = await db.assignment.findFirst({
    where: { tenantId, inquiryId, teamLeaderId: teamLeader.id },
    select: { id: true },
  });
  if (existing) {
    return {
      teamLeaderId: teamLeader.id,
      teamLeaderName: teamLeader.name || teamLeader.email,
    };
  }

  await db.assignment.create({
    data: {
      tenantId,
      inquiryId,
      teamLeaderId: teamLeader.id,
      assignedById,
      sortOrder: 0,
      noCrewMembers: true,
    },
  });

  void notifyNewAssignmentForInquiry(tenantId, inquiryId, [teamLeader.id], []).catch((e) =>
    console.error('[quick-paste] solo assign notify', e),
  );

  return {
    teamLeaderId: teamLeader.id,
    teamLeaderName: teamLeader.name || teamLeader.email,
  };
}
