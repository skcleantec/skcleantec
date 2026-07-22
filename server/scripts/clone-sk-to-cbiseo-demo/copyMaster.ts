import type { CloneContext, CloneStats } from './types.js';
import { mapOperatingCompanyId } from './resolveTenants.js';

/** 기간 내 접수에 등장하는 팀·팀원·타업체 복사 + 가명화 */
export async function copyMasterData(ctx: CloneContext): Promise<CloneStats> {
  const { prisma, sourceTenantId, sourceOcIds, fromDate, dryRun, ids, anonymizer, users, log } = ctx;
  const stats: CloneStats = {};

  const assignmentRows = await prisma.assignment.findMany({
    where: {
      tenantId: sourceTenantId,
      inquiry: {
        tenantId: sourceTenantId,
        operatingCompanyId: { in: sourceOcIds },
        createdAt: { gte: fromDate },
      },
    },
    select: { teamLeaderId: true },
  });
  const leaderUserIds = [...new Set(assignmentRows.map((a) => a.teamLeaderId))];
  await users.preloadFromIds(prisma, leaderUserIds);

  const leaderTeams = await prisma.team.findMany({
    where: { tenantId: sourceTenantId, teamLeaderId: { in: leaderUserIds } },
    include: { members: true },
  });

  const crewMemberIds = (
    await prisma.inquiryCrewMemberMeetingTime.findMany({
      where: {
        tenantId: sourceTenantId,
        inquiry: { operatingCompanyId: { in: sourceOcIds }, createdAt: { gte: fromDate } },
      },
      select: { teamMemberId: true },
    })
  ).map((r) => r.teamMemberId);

  for (const srcTeam of leaderTeams) {
    const newTeamId = ids.assign(srcTeam.id);
    const newLeaderId = users.map(srcTeam.teamLeaderId, 'TEAM_LEADER');
    if (dryRun) {
      stats.teams = (stats.teams ?? 0) + 1;
      stats.teamMembers = (stats.teamMembers ?? 0) + srcTeam.members.length;
      continue;
    }
    await prisma.team.create({
      data: {
        id: newTeamId,
        tenantId: ctx.targetTenantId,
        teamLeaderId: newLeaderId,
        memo: anonymizer.scrubText(srcTeam.memo),
      },
    });
    stats.teams = (stats.teams ?? 0) + 1;

    for (const m of srcTeam.members) {
      await createTeamMember(ctx, m, newTeamId, stats);
    }
  }

  for (const orphanMemberId of [...new Set(crewMemberIds)]) {
    if (ids.get(orphanMemberId)) continue;
    const m = await prisma.teamMember.findFirst({
      where: { id: orphanMemberId, tenantId: sourceTenantId },
    });
    if (!m) continue;
    await createTeamMember(ctx, m, m.teamId ? ids.get(m.teamId) ?? null : null, stats);
  }

  const extRows = await prisma.externalCompany.findMany({
    where: {
      tenantId: sourceTenantId,
      OR: [
        {
          partnerUsers: {
            some: {
              assignmentsAssigned: {
                some: {
                  inquiry: {
                    operatingCompanyId: { in: sourceOcIds },
                    createdAt: { gte: fromDate },
                  },
                },
              },
            },
          },
        },
        {
          inquiriesCancelFeeFor: {
            some: {
              operatingCompanyId: { in: sourceOcIds },
              createdAt: { gte: fromDate },
            },
          },
        },
      ],
    },
  });

  for (const ext of extRows) {
    const newExtId = ids.assign(ext.id);
    if (dryRun) {
      stats.externalCompanies = (stats.externalCompanies ?? 0) + 1;
      continue;
    }
    const photo = anonymizer.dummyPhoto(ext.id);
    await prisma.externalCompany.create({
      data: {
        id: newExtId,
        tenantId: ctx.targetTenantId,
        name: anonymizer.demoExternalCompanyName(ext.id),
        bizNumber: null,
        phone: anonymizer.demoPhone(ext.id),
        memo: anonymizer.scrubText(ext.memo),
        businessRegistrationImageUrl: photo.url,
        businessRegistrationImagePublicId: photo.publicId,
        isActive: ext.isActive,
        usageDisabledAt: ext.usageDisabledAt,
        linkedPartnerTenantId: null,
      },
    });
    stats.externalCompanies = (stats.externalCompanies ?? 0) + 1;
  }

  log(`[master] teams=${stats.teams ?? 0} members=${stats.teamMembers ?? 0} external=${stats.externalCompanies ?? 0}`);
  return stats;
}

async function createTeamMember(
  ctx: CloneContext,
  m: {
    id: string;
    nationality: 'KO' | 'TH' | 'MN';
    sortOrder: number;
    isActive: boolean;
    hireDate: Date | null;
    resignationDate: Date | null;
    monthlyPayDay: number | null;
    payAmountPerJob: number | null;
  },
  teamId: string | null,
  stats: CloneStats,
) {
  const { ids, anonymizer, dryRun, prisma, targetTenantId } = ctx;
  const newMemberId = ids.assign(m.id);
  if (dryRun) {
    stats.teamMembers = (stats.teamMembers ?? 0) + 1;
    return;
  }
  const photo = anonymizer.dummyPhoto(m.id);
  await prisma.teamMember.create({
    data: {
      id: newMemberId,
      tenantId: targetTenantId,
      teamId,
      name: anonymizer.demoTeamMemberName(m.id),
      nameTh: null,
      nationality: m.nationality,
      phone: anonymizer.demoPhone(m.id),
      homeAddress: anonymizer.demoAddress(m.id),
      homeAddressDetail: anonymizer.demoAddressDetail(),
      sortOrder: m.sortOrder,
      isActive: m.isActive,
      hireDate: m.hireDate,
      resignationDate: m.resignationDate,
      monthlyPayDay: m.monthlyPayDay,
      payAmountPerJob: m.payAmountPerJob,
      staffIdCardPublicId: photo.publicId,
      staffIdCardUrl: photo.url,
    },
  });
  stats.teamMembers = (stats.teamMembers ?? 0) + 1;
}

export function mapTeamMemberId(ctx: CloneContext, sourceId: string | null | undefined): string | null {
  if (!sourceId) return null;
  return ctx.ids.get(sourceId) ?? null;
}

export function mapExternalCompanyId(ctx: CloneContext, sourceId: string | null | undefined): string | null {
  if (!sourceId) return null;
  return ctx.ids.get(sourceId) ?? null;
}

export function targetOcId(ctx: CloneContext, sourceOcId: string): string {
  return mapOperatingCompanyId(sourceOcId, ctx.sourceOcIds, ctx.targetDefaultOcId);
}
