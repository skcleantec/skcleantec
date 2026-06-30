import type { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID } from '../../src/modules/tenants/tenant.constants.js';
import {
  GUIDE_DEMO_CREW_GROUP_ID,
  GUIDE_DEMO_ECONTRACT_DEF_ID,
  GUIDE_DEMO_EXTERNAL_COMPANY_ID,
  GUIDE_DEMO_ORDER_TOKEN_PREFIX,
  GUIDE_DEMO_TAG,
  GUIDE_DEMO_TEAM_TAG,
  guideDemoAdSessionId,
  guideDemoEContractIssuanceId,
  guideDemoPayrollMonthAdjustId,
  guideDemoPayrollSettlementId,
} from './constants.js';

async function purgeInquiriesByMemoTag(
  prisma: PrismaClient,
  tenantId: string,
  tag: string,
): Promise<number> {
  const inquiryRows = await prisma.inquiry.findMany({
    where: { tenantId, memo: { contains: tag } },
    select: { id: true },
  });
  const inquiryIds = inquiryRows.map((r) => r.id);
  if (inquiryIds.length === 0) return 0;

  await prisma.inquiryChangeLog.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
  await prisma.inquiryExtraCharge.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
  await prisma.inquiryCleaningPhoto.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
  await prisma.inquiryInspectionChecklist.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
  await prisma.inquiryCrewMemberMeetingTime.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
  await prisma.assignment.deleteMany({ where: { tenantId, inquiryId: { in: inquiryIds } } });
  await prisma.orderFollowup.updateMany({
    where: { tenantId, inquiryId: { in: inquiryIds } },
    data: { inquiryId: null },
  });

  const listings = await prisma.inquiryDbListing.findMany({
    where: { inquiryId: { in: inquiryIds } },
    select: { id: true },
  });
  const listingIds = listings.map((l) => l.id);
  if (listingIds.length > 0) {
    await prisma.inquiryDbListingMessage.deleteMany({ where: { listingId: { in: listingIds } } });
    await prisma.inquiryDbListingAudience.deleteMany({ where: { listingId: { in: listingIds } } });
    await prisma.inquiryDbListing.deleteMany({ where: { id: { in: listingIds } } });
  }

  await prisma.csReport.updateMany({
    where: { tenantId, inquiryId: { in: inquiryIds } },
    data: { inquiryId: null },
  });

  const deleted = await prisma.inquiry.deleteMany({ where: { id: { in: inquiryIds } } });
  return deleted.count;
}

export async function purgeGuideDemoAdminSeed(prisma: PrismaClient): Promise<{
  inquiries: number;
  orderForms: number;
  followups: number;
}> {
  const tenantId = DEFAULT_TENANT_ID;

  const followupRows = await prisma.orderFollowup.findMany({
    where: { tenantId, memo: { contains: GUIDE_DEMO_TAG } },
    select: { id: true },
  });
  const followupIds = followupRows.map((r) => r.id);
  if (followupIds.length > 0) {
    await prisma.orderFollowupLog.deleteMany({ where: { followupId: { in: followupIds } } });
    await prisma.orderFollowup.deleteMany({ where: { id: { in: followupIds } } });
  }

  const orderFormRows = await prisma.orderForm.findMany({
    where: { tenantId, token: { startsWith: GUIDE_DEMO_ORDER_TOKEN_PREFIX } },
    select: { id: true },
  });
  const orderFormIds = orderFormRows.map((r) => r.id);

  if (orderFormIds.length > 0) {
    const linkedInquiries = await prisma.inquiry.findMany({
      where: { tenantId, orderFormId: { in: orderFormIds } },
      select: { id: true },
    });
    const linkedIds = linkedInquiries.map((r) => r.id);
    if (linkedIds.length > 0) {
      await prisma.inquiryChangeLog.deleteMany({ where: { inquiryId: { in: linkedIds } } });
      await prisma.assignment.deleteMany({ where: { tenantId, inquiryId: { in: linkedIds } } });
      await prisma.inquiry.deleteMany({ where: { id: { in: linkedIds } } });
    }
    await prisma.orderForm.deleteMany({ where: { id: { in: orderFormIds } } });
  }

  const inquiries = await purgeInquiriesByMemoTag(prisma, tenantId, GUIDE_DEMO_TAG);

  return {
    inquiries,
    orderForms: orderFormIds.length,
    followups: followupIds.length,
  };
}

export async function purgeGuideDemoTeamSeed(prisma: PrismaClient): Promise<number> {
  return purgeInquiriesByMemoTag(prisma, DEFAULT_TENANT_ID, GUIDE_DEMO_TEAM_TAG);
}

export async function purgeGuideDemoCsSeed(prisma: PrismaClient): Promise<number> {
  const tenantId = DEFAULT_TENANT_ID;
  const deleted = await prisma.csReport.deleteMany({
    where: { tenantId, memo: { contains: GUIDE_DEMO_TAG } },
  });
  return deleted.count;
}

export async function purgeGuideDemoMarketplaceSeed(prisma: PrismaClient): Promise<number> {
  return purgeInquiriesByMemoTag(prisma, DEFAULT_TENANT_ID, `${GUIDE_DEMO_TAG} 마켓`);
}

export async function purgeGuideDemoExternalSeed(prisma: PrismaClient): Promise<number> {
  const tenantId = DEFAULT_TENANT_ID;
  const tagInquiries = await purgeInquiriesByMemoTag(prisma, tenantId, `${GUIDE_DEMO_TAG} 타업체`);

  const partnerUsers = await prisma.user.findMany({
    where: { tenantId, externalCompanyId: GUIDE_DEMO_EXTERNAL_COMPANY_ID },
    select: { id: true },
  });
  for (const u of partnerUsers) {
    await prisma.assignment.deleteMany({ where: { teamLeaderId: u.id } });
  }
  await prisma.user.deleteMany({ where: { externalCompanyId: GUIDE_DEMO_EXTERNAL_COMPANY_ID } });
  await prisma.externalCompanySettlementPayment.deleteMany({
    where: { externalCompanyId: GUIDE_DEMO_EXTERNAL_COMPANY_ID },
  });
  await prisma.externalCompanySettlementReset.deleteMany({
    where: { externalCompanyId: GUIDE_DEMO_EXTERNAL_COMPANY_ID },
  });
  await prisma.externalCompany.deleteMany({ where: { id: GUIDE_DEMO_EXTERNAL_COMPANY_ID } });

  return tagInquiries;
}

export async function purgeGuideDemoCrewSeed(prisma: PrismaClient): Promise<number> {
  const removed = await purgeInquiriesByMemoTag(prisma, DEFAULT_TENANT_ID, `${GUIDE_DEMO_TAG} 크루`);
  await prisma.teamCrewGroupDayRoster.deleteMany({ where: { groupId: GUIDE_DEMO_CREW_GROUP_ID } });
  await prisma.teamCrewGroupMember.deleteMany({ where: { groupId: GUIDE_DEMO_CREW_GROUP_ID } });
  await prisma.teamCrewGroup.deleteMany({ where: { id: GUIDE_DEMO_CREW_GROUP_ID } });
  return removed;
}

export async function purgeGuideDemoPremiumSeed(prisma: PrismaClient): Promise<{
  adSessions: number;
  payrollSettlements: number;
  eContractIssuances: number;
}> {
  const sessionIds = [1, 2, 3].map((n) => guideDemoAdSessionId(n));
  const adDeleted = await prisma.adWorkSession.deleteMany({
    where: { id: { in: sessionIds }, tenantId: DEFAULT_TENANT_ID },
  });

  const payrollIds = [1, 2, 3].map((n) => guideDemoPayrollSettlementId(n));
  const payrollDeleted = await prisma.$transaction(async (tx) => {
    await tx.teamMemberPayrollMonthAdjust.deleteMany({ where: { id: guideDemoPayrollMonthAdjustId() } });
    const team = await tx.teamMemberPayrollSettlement.deleteMany({ where: { id: { in: payrollIds.slice(0, 2) } } });
    const marketer = await tx.marketerPayrollSettlement.deleteMany({ where: { id: payrollIds[2] } });
    return team.count + marketer.count;
  });

  const issuanceIds = [1, 2, 3].map((n) => guideDemoEContractIssuanceId(n));
  const eContractDeleted = await prisma.$transaction(async (tx) => {
    await tx.eContractSubmission.deleteMany({
      where: { issuanceId: { in: issuanceIds } },
    });
    const iss = await tx.eContractIssuance.deleteMany({ where: { id: { in: issuanceIds } } });
    await tx.eContractVersion.deleteMany({ where: { definitionId: GUIDE_DEMO_ECONTRACT_DEF_ID } });
    await tx.eContractDefinition.deleteMany({ where: { id: GUIDE_DEMO_ECONTRACT_DEF_ID } });
    return iss.count;
  });

  return {
    adSessions: adDeleted.count,
    payrollSettlements: payrollDeleted,
    eContractIssuances: eContractDeleted,
  };
}

export async function purgeGuideDemoAllExceptTeamHelpdesk(prisma: PrismaClient): Promise<void> {
  await purgeGuideDemoAdminSeed(prisma);
  await purgeGuideDemoTeamSeed(prisma);
  await purgeGuideDemoCrewSeed(prisma);
  await purgeGuideDemoCsSeed(prisma);
  await purgeGuideDemoMarketplaceSeed(prisma);
  await purgeGuideDemoExternalSeed(prisma);
  await purgeGuideDemoPremiumSeed(prisma);
}
