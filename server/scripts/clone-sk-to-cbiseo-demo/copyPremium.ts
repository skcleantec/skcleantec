import type { Prisma } from '@prisma/client';
import type { CloneContext, CloneStats } from './types.js';
import { mapTeamMemberId } from './copyMaster.js';

export async function copyPremiumData(ctx: CloneContext): Promise<CloneStats> {
  const { prisma, sourceTenantId, fromDate, dryRun, ids, anonymizer, users, log } = ctx;
  const stats: CloneStats = {};

  const adSessions = await prisma.adWorkSession.findMany({
    where: { tenantId: sourceTenantId, startedAt: { gte: fromDate } },
    include: { spendLines: true },
  });

  for (const session of adSessions) {
    if (dryRun) {
      stats.adWorkSessions = (stats.adWorkSessions ?? 0) + 1;
      continue;
    }
    await users.preloadFromIds(prisma, [session.userId]);
    const newSessionId = ids.assign(session.id);
    await prisma.adWorkSession.create({
      data: {
        id: newSessionId,
        tenantId: ctx.targetTenantId,
        userId: users.map(session.userId, 'MARKETER'),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        bookingDenominatorCount: session.bookingDenominatorCount,
        bookingDenominatorManual: session.bookingDenominatorManual,
      },
    });
    stats.adWorkSessions = (stats.adWorkSessions ?? 0) + 1;

    for (const line of session.spendLines) {
      const targetChannel = await prisma.adChannel.findFirst({
        where: { tenantId: ctx.targetTenantId, name: (await prisma.adChannel.findUnique({
          where: { id: line.channelId },
          select: { name: true },
        }))?.name },
        select: { id: true },
      });
      if (!targetChannel) continue;
      await prisma.adSpendLine.create({
        data: {
          id: ids.assign(line.id),
          sessionId: newSessionId,
          channelId: targetChannel.id,
          amount: line.amount,
          soomgoReceivedCount: line.soomgoReceivedCount,
          soomgoAutoEstimateCount: line.soomgoAutoEstimateCount,
          soomgoConfirmedCount: line.soomgoConfirmedCount,
          countBreakdown: line.countBreakdown ?? undefined,
        },
      });
    }
  }

  const teamPayrolls = await prisma.teamMemberPayrollSettlement.findMany({
    where: {
      teamMember: { tenantId: sourceTenantId },
      settledAt: { gte: fromDate },
    },
  });
  for (const row of teamPayrolls) {
    const tmId = mapTeamMemberId(ctx, row.teamMemberId);
    if (!tmId) continue;
    if (dryRun) {
      stats.teamPayroll = (stats.teamPayroll ?? 0) + 1;
      continue;
    }
    await users.preloadFromIds(prisma, [row.actorId]);
    await prisma.teamMemberPayrollSettlement.create({
      data: {
        id: ids.assign(row.id),
        teamMemberId: tmId,
        monthKey: row.monthKey,
        amount: row.amount,
        settledAt: row.settledAt,
        actorId: users.mapOptional(row.actorId, 'ADMIN'),
      },
    });
    stats.teamPayroll = (stats.teamPayroll ?? 0) + 1;
  }

  const marketerPayrolls = await prisma.marketerPayrollSettlement.findMany({
    where: {
      user: { tenantId: sourceTenantId },
      settledAt: { gte: fromDate },
    },
  });
  for (const row of marketerPayrolls) {
    if (dryRun) {
      stats.marketerPayroll = (stats.marketerPayroll ?? 0) + 1;
      continue;
    }
    await users.preloadFromIds(prisma, [row.userId, row.actorId]);
    await prisma.marketerPayrollSettlement.create({
      data: {
        id: ids.assign(row.id),
        userId: users.map(row.userId, 'MARKETER'),
        monthKey: row.monthKey,
        openingCarryForward: row.openingCarryForward,
        scheduledMonthlySalary: row.scheduledMonthlySalary,
        settledAmount: row.settledAmount,
        memo: anonymizer.scrubText(row.memo),
        settledAt: row.settledAt,
        actorId: users.mapOptional(row.actorId, 'ADMIN'),
      },
    });
    stats.marketerPayroll = (stats.marketerPayroll ?? 0) + 1;
  }

  const monthAdjusts = await prisma.teamMemberPayrollMonthAdjust.findMany({
    where: {
      teamMember: { tenantId: sourceTenantId },
      updatedAt: { gte: fromDate },
    },
  });
  for (const adj of monthAdjusts) {
    const tmId = mapTeamMemberId(ctx, adj.teamMemberId);
    if (!tmId) continue;
    if (dryRun) continue;
    await prisma.teamMemberPayrollMonthAdjust.create({
      data: {
        id: ids.assign(adj.id),
        teamMemberId: tmId,
        monthKey: adj.monthKey,
        extraWorkDays: adj.extraWorkDays,
        createdAt: adj.createdAt,
        updatedAt: adj.updatedAt,
      },
    });
  }

  const eDefs = await prisma.eContractDefinition.findMany({
    where: {
      tenantId: sourceTenantId,
      OR: [
        { updatedAt: { gte: fromDate } },
        { issuances: { some: { updatedAt: { gte: fromDate } } } },
      ],
    },
    include: {
      versions: { include: { issuances: { include: { submission: true } } } },
    },
  });

  for (const def of eDefs) {
    if (dryRun) {
      stats.eContractDefs = (stats.eContractDefs ?? 0) + 1;
      continue;
    }
    const newDefId = ids.assign(def.id);
    await users.preloadFromIds(prisma, [def.createdById]);
    await prisma.eContractDefinition.create({
      data: {
        id: newDefId,
        tenantId: ctx.targetTenantId,
        title: def.title,
        description: anonymizer.scrubText(def.description),
        audience: def.audience,
        isArchived: def.isArchived,
        createdAt: def.createdAt,
        updatedAt: def.updatedAt,
        createdById: users.mapOptional(def.createdById, 'ADMIN'),
      },
    });
    stats.eContractDefs = (stats.eContractDefs ?? 0) + 1;

    for (const ver of def.versions) {
      const newVerId = ids.assign(ver.id);
      await users.preloadFromIds(prisma, [ver.publishedById]);
      await prisma.eContractVersion.create({
        data: {
          id: newVerId,
          definitionId: newDefId,
          status: ver.status,
          publishedOrdinal: ver.publishedOrdinal,
          titleSnapshot: ver.titleSnapshot,
          bodyMarkdown: ver.bodyMarkdown,
          issuerSnapshot: ver.issuerSnapshot ?? undefined,
          bodyDisplayHtml: ver.bodyDisplayHtml,
          contentHash: ver.contentHash,
          publishedAt: ver.publishedAt,
          publishedById: users.mapOptional(ver.publishedById, 'ADMIN'),
          createdAt: ver.createdAt,
          updatedAt: ver.updatedAt,
        },
      });

      for (const iss of ver.issuances) {
        const newIssId = ids.assign(iss.id);
        await users.preloadFromIds(prisma, [iss.teamLeaderId]);
        await prisma.eContractIssuance.create({
          data: {
            id: newIssId,
            token: anonymizer.newToken('cbec', iss.id),
            definitionId: newDefId,
            versionId: newVerId,
            teamLeaderId: users.mapOptional(iss.teamLeaderId, 'TEAM_LEADER'),
            teamMemberId: mapTeamMemberId(ctx, iss.teamMemberId),
            recipientLabel: iss.recipientLabel
              ? anonymizer.demoTeamMemberName(iss.id)
              : null,
            status: iss.status,
            expiresAt: iss.expiresAt,
            notes: anonymizer.scrubText(iss.notes),
            mergeFields: scrubMergeFields(iss.mergeFields, anonymizer) as Prisma.InputJsonValue,
            createdAt: iss.createdAt,
            updatedAt: iss.updatedAt,
          },
        });
        stats.eContractIssuances = (stats.eContractIssuances ?? 0) + 1;

        if (iss.submission) {
          const sub = iss.submission;
          const sig = anonymizer.dummyPhoto(sub.id);
          await prisma.eContractSubmission.create({
            data: {
              id: ids.assign(sub.id),
              issuanceId: newIssId,
              versionId: newVerId,
              signedAt: sub.signedAt,
              payload: scrubMergeFields(sub.payload, anonymizer) as Prisma.InputJsonValue,
              versionContentHash: sub.versionContentHash,
              selfiePublicId: sig.publicId,
              selfieUrl: sig.url,
              signaturePublicId: sig.publicId,
              signatureUrl: sig.url,
              mergedContractHtml: null,
              finalPdfPublicId: sub.finalPdfPublicId ? sig.publicId : null,
              finalPdfUrl: sub.finalPdfUrl ? sig.url : null,
              signerUserAgent: null,
              signerIp: null,
            },
          });
        }
      }
    }
  }

  log(
    `[premium] ad=${stats.adWorkSessions ?? 0} teamPayroll=${stats.teamPayroll ?? 0} marketerPayroll=${stats.marketerPayroll ?? 0} eContract=${stats.eContractIssuances ?? 0}`,
  );
  return stats;
}

function scrubMergeFields(
  fields: unknown,
  anonymizer: import('./anonymize.js').Anonymizer,
): unknown {
  if (!fields || typeof fields !== 'object') return fields;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
    out[k] = typeof v === 'string' ? anonymizer.scrubText(v) ?? v : v;
  }
  return out;
}
