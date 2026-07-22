import type { CloneContext, CloneStats } from './types.js';
import { mapExternalCompanyId, targetOcId } from './copyMaster.js';
import { CLONE_DEMO_TAG } from './constants.js';

export async function copySecondaryData(ctx: CloneContext): Promise<CloneStats> {
  const { prisma, sourceTenantId, sourceOcIds, fromDate, dryRun, ids, anonymizer, users, log } = ctx;
  const stats: CloneStats = {};

  const sourceInquiryIds = (
    await prisma.inquiry.findMany({
      where: {
        tenantId: sourceTenantId,
        operatingCompanyId: { in: sourceOcIds },
        createdAt: { gte: fromDate },
      },
      select: { id: true },
    })
  ).map((r) => r.id);

  // --- OrderFollowup (linked or same period) ---
  const followups = await prisma.orderFollowup.findMany({
    where: {
      tenantId: sourceTenantId,
      operatingCompanyId: { in: sourceOcIds },
      OR: [{ inquiryId: { in: sourceInquiryIds } }, { createdAt: { gte: fromDate } }],
    },
    include: { logs: true },
  });

  for (const f of followups) {
    if (dryRun) {
      stats.orderFollowups = (stats.orderFollowups ?? 0) + 1;
      continue;
    }
    const newId = ids.assign(f.id);
    await users.preloadFromIds(prisma, [f.createdById, f.handledById]);
    await prisma.orderFollowup.create({
      data: {
        id: newId,
        tenantId: ctx.targetTenantId,
        operatingCompanyId: targetOcId(ctx, f.operatingCompanyId),
        inquiryId: f.inquiryId ? ids.get(f.inquiryId) ?? null : null,
        customerName: anonymizer.demoCustomerName(f.id),
        nickname: f.nickname ? anonymizer.demoCustomerName(`${f.id}:nick`) : null,
        customerPhone: anonymizer.demoPhone(f.id),
        customerPhone2: f.customerPhone2 ? anonymizer.demoPhone(`${f.id}:2`) : null,
        status: f.status,
        deferCount: f.deferCount,
        goldDb: f.goldDb,
        preferredMoveInCleaningDate: f.preferredMoveInCleaningDate,
        memo: anonymizer.scrubText(f.memo ?? `${CLONE_DEMO_TAG}`),
        nextContactAt: f.nextContactAt,
        depositReceivedAt: f.depositReceivedAt,
        createdById: users.map(f.createdById, 'MARKETER'),
        handledById: users.mapOptional(f.handledById, 'MARKETER'),
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      },
    });
    stats.orderFollowups = (stats.orderFollowups ?? 0) + 1;

    for (const lg of f.logs) {
      await users.preloadFromIds(prisma, [lg.actorId]);
      await prisma.orderFollowupLog.create({
        data: {
          id: ids.assign(lg.id),
          followupId: newId,
          actorId: users.map(lg.actorId, 'MARKETER'),
          action: lg.action,
          detail: anonymizer.scrubText(lg.detail),
          createdAt: lg.createdAt,
        },
      });
    }
  }

  // --- C/S ---
  const csRows = await prisma.csReport.findMany({
    where: {
      tenantId: sourceTenantId,
      OR: [{ inquiryId: { in: sourceInquiryIds } }, { createdAt: { gte: fromDate } }],
    },
  });

  for (const cs of csRows) {
    if (dryRun) {
      stats.csReports = (stats.csReports ?? 0) + 1;
      continue;
    }
    const dummyUrls = [anonymizer.dummyPhoto(cs.id).url];
    await users.preloadFromIds(prisma, [cs.completedById, cs.forwardedToUserId]);
    await prisma.csReport.create({
      data: {
        id: ids.assign(cs.id),
        tenantId: ctx.targetTenantId,
        customerName: anonymizer.demoCustomerName(cs.id),
        customerPhone: anonymizer.demoPhone(cs.id),
        content: anonymizer.scrubText(cs.content) ?? cs.content,
        serviceRating: cs.serviceRating,
        imageUrls: dummyUrls,
        status: cs.status,
        memo: anonymizer.scrubText(cs.memo),
        inquiryId: cs.inquiryId ? ids.get(cs.inquiryId) ?? null : null,
        completedAt: cs.completedAt,
        completedById: users.mapOptional(cs.completedById, 'ADMIN'),
        completionMethod: anonymizer.scrubText(cs.completionMethod),
        forwardedToUserId: users.mapOptional(cs.forwardedToUserId, 'TEAM_LEADER'),
        asServiceDate: cs.asServiceDate,
        createdAt: cs.createdAt,
      },
    });
    stats.csReports = (stats.csReports ?? 0) + 1;
  }

  // --- DB Marketplace ---
  const listings = await prisma.inquiryDbListing.findMany({
    where: { inquiryId: { in: sourceInquiryIds } },
    include: { audiences: true, messages: true },
  });

  for (const listing of listings) {
    if (dryRun) {
      stats.dbListings = (stats.dbListings ?? 0) + 1;
      continue;
    }
    const newListingId = ids.assign(listing.id);
    const inqId = ids.mustGet(listing.inquiryId, 'listing.inquiry');
    await users.preloadFromIds(prisma, [
      listing.buyerConfirmedByUserId,
      listing.sellerConfirmedByUserId,
      listing.holdByUserId,
    ]);
    await prisma.inquiryDbListing.create({
      data: {
        id: newListingId,
        tenantId: ctx.targetTenantId,
        inquiryId: inqId,
        listingFee: listing.listingFee,
        displayAmount: listing.displayAmount,
        status: listing.status,
        visibility: listing.visibility,
        publishedAt: listing.publishedAt,
        withdrawnAt: listing.withdrawnAt,
        expiresAt: listing.expiresAt,
        expiredAt: listing.expiredAt,
        platformSuspendedAt: listing.platformSuspendedAt,
        confirmedAt: listing.confirmedAt,
        buyerKind: listing.buyerKind,
        buyerTenantId: null,
        buyerExternalCompanyId: mapExternalCompanyId(ctx, listing.buyerExternalCompanyId),
        buyerConfirmedAt: listing.buyerConfirmedAt,
        sellerConfirmedAt: listing.sellerConfirmedAt,
        buyerConfirmedByUserId: users.mapOptional(listing.buyerConfirmedByUserId, 'ADMIN'),
        sellerConfirmedByUserId: users.mapOptional(listing.sellerConfirmedByUserId, 'ADMIN'),
        holdBuyerKind: listing.holdBuyerKind,
        holdBuyerTenantId: null,
        holdBuyerExternalCompanyId: mapExternalCompanyId(ctx, listing.holdBuyerExternalCompanyId),
        holdByUserId: users.mapOptional(listing.holdByUserId, 'ADMIN'),
        heldUntil: listing.heldUntil,
        tenantInquiryShareId: null,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      },
    });
    stats.dbListings = (stats.dbListings ?? 0) + 1;

    for (const aud of listing.audiences) {
      await prisma.inquiryDbListingAudience.create({
        data: {
          id: ids.assign(aud.id),
          listingId: newListingId,
          audienceKind: aud.audienceKind,
          partnerTenantId: null,
          externalCompanyId: mapExternalCompanyId(ctx, aud.externalCompanyId),
        },
      });
    }

    for (const msg of listing.messages) {
      await users.preloadFromIds(prisma, [msg.authorUserId]);
      await prisma.inquiryDbListingMessage.create({
        data: {
          id: ids.assign(msg.id),
          tenantId: ctx.targetTenantId,
          listingId: newListingId,
          authorUserId: users.map(msg.authorUserId, 'ADMIN'),
          authorRole: msg.authorRole,
          body: anonymizer.scrubText(msg.body) ?? msg.body,
          createdAt: msg.createdAt,
        },
      });
    }
  }

  log(
    `[secondary] followups=${stats.orderFollowups ?? 0} cs=${stats.csReports ?? 0} listings=${stats.dbListings ?? 0}`,
  );
  return stats;
}
