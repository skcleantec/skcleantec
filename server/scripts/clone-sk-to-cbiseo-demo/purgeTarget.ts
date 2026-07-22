import type { PrismaClient } from '@prisma/client';
import { PRESERVE_TARGET_USER_EMAILS } from './constants.js';

/** cbiseo 업무 데이터 전량 삭제 — Tenant·데모 User·TenantFeature 유지 */
export async function purgeTargetTenantBusinessData(
  prisma: PrismaClient,
  targetTenantId: string,
  dryRun: boolean,
  log: (msg: string) => void,
): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  const inquiryRows = await prisma.inquiry.findMany({
    where: { tenantId: targetTenantId },
    select: { id: true },
  });
  const inquiryIds = inquiryRows.map((r) => r.id);
  stats.inquiries = inquiryIds.length;

  if (dryRun) {
    log(`[dry-run] purge 대상 접수 ${inquiryIds.length}건`);
    return stats;
  }

  if (inquiryIds.length > 0) {
    await prisma.inquiryDbListingMessage.deleteMany({
      where: { listing: { inquiryId: { in: inquiryIds } } },
    });
    await prisma.inquiryDbListingAudience.deleteMany({
      where: { listing: { inquiryId: { in: inquiryIds } } },
    });
    await prisma.inquiryDbListing.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.tenantInquiryShare.deleteMany({
      where: {
        OR: [{ sourceInquiryId: { in: inquiryIds } }, { targetInquiryId: { in: inquiryIds } }],
      },
    });
    await prisma.telecrmCallNote.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.telecrmCallSession.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.telecrmConsultationQuote.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.landingContactInquiry.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.userCustomCalendarInquiryPin.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.reviewPaybackRequest.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.quotationEmailLog.deleteMany({ where: { quotation: { inquiryId: { in: inquiryIds } } } });
    await prisma.quotationLineItem.deleteMany({ where: { quotation: { inquiryId: { in: inquiryIds } } } });
    await prisma.quotation.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryInspectionAreaPhoto.deleteMany({
      where: { item: { area: { checklist: { inquiryId: { in: inquiryIds } } } } },
    });
    await prisma.inquiryInspectionItem.deleteMany({
      where: { area: { checklist: { inquiryId: { in: inquiryIds } } } },
    });
    await prisma.inquiryInspectionArea.deleteMany({
      where: { checklist: { inquiryId: { in: inquiryIds } } },
    });
    await prisma.inquiryInspectionChecklist.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryCleaningPhoto.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryConsultationPhoto.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryCrewMemberMeetingTime.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryAdditionalReceipt.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryExtraCharge.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryChangeLog.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.inquiryStatusEvent.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    await prisma.assignment.deleteMany({ where: { tenantId: targetTenantId, inquiryId: { in: inquiryIds } } });
    await prisma.csReport.deleteMany({ where: { tenantId: targetTenantId, inquiryId: { in: inquiryIds } } });
    await prisma.orderFollowupLog.deleteMany({
      where: { followup: { tenantId: targetTenantId, inquiryId: { in: inquiryIds } } },
    });
    await prisma.orderFollowup.updateMany({
      where: { tenantId: targetTenantId, inquiryId: { in: inquiryIds } },
      data: { inquiryId: null },
    });
    await prisma.inquiry.deleteMany({ where: { id: { in: inquiryIds } } });
  }

  stats.orderFollowups = (
    await prisma.orderFollowup.deleteMany({ where: { tenantId: targetTenantId } })
  ).count;
  stats.csReports = (await prisma.csReport.deleteMany({ where: { tenantId: targetTenantId } })).count;

  const orderFormIds = (
    await prisma.orderForm.findMany({ where: { tenantId: targetTenantId }, select: { id: true } })
  ).map((r) => r.id);
  if (orderFormIds.length) {
    await prisma.orderFormPhoto.deleteMany({ where: { orderFormId: { in: orderFormIds } } });
    await prisma.orderFormSubmissionEmailLog.deleteMany({ where: { orderFormId: { in: orderFormIds } } });
    await prisma.reviewPaybackRequest.deleteMany({ where: { orderFormId: { in: orderFormIds } } });
    await prisma.orderFormDeleteLog.deleteMany({ where: { orderFormId: { in: orderFormIds } } });
  }
  stats.orderForms = (await prisma.orderForm.deleteMany({ where: { tenantId: targetTenantId } })).count;

  stats.quotations = (await prisma.quotation.deleteMany({ where: { tenantId: targetTenantId } })).count;

  const adSessions = await prisma.adWorkSession.findMany({
    where: { tenantId: targetTenantId },
    select: { id: true },
  });
  if (adSessions.length) {
    await prisma.adSpendLine.deleteMany({ where: { sessionId: { in: adSessions.map((s) => s.id) } } });
  }
  stats.adWorkSessions = (
    await prisma.adWorkSession.deleteMany({ where: { tenantId: targetTenantId } })
  ).count;

  await prisma.teamMemberPayrollMonthAdjust.deleteMany({
    where: { teamMember: { tenantId: targetTenantId } },
  });
  stats.teamPayroll = (
    await prisma.teamMemberPayrollSettlement.deleteMany({
      where: { teamMember: { tenantId: targetTenantId } },
    })
  ).count;
  stats.marketerPayroll = (
    await prisma.marketerPayrollSettlement.deleteMany({
      where: { user: { tenantId: targetTenantId } },
    })
  ).count;

  const issuanceIds = (
    await prisma.eContractIssuance.findMany({
      where: { definition: { tenantId: targetTenantId } },
      select: { id: true },
    })
  ).map((r) => r.id);
  if (issuanceIds.length) {
    await prisma.eContractSubmission.deleteMany({ where: { issuanceId: { in: issuanceIds } } });
  }
  stats.eContractIssuances = (
    await prisma.eContractIssuance.deleteMany({
      where: { definition: { tenantId: targetTenantId } },
    })
  ).count;
  const defIds = (
    await prisma.eContractDefinition.findMany({
      where: { tenantId: targetTenantId },
      select: { id: true },
    })
  ).map((r) => r.id);
  if (defIds.length) {
    await prisma.eContractVersion.deleteMany({ where: { definitionId: { in: defIds } } });
  }
  stats.eContractDefs = (
    await prisma.eContractDefinition.deleteMany({ where: { tenantId: targetTenantId } })
  ).count;

  const crewGroups = await prisma.teamCrewGroup.findMany({
    where: { tenantId: targetTenantId },
    select: { id: true },
  });
  for (const g of crewGroups) {
    await prisma.teamCrewGroupExpenseAttachment.deleteMany({
      where: { expense: { crewGroupId: g.id } },
    });
    await prisma.teamCrewGroupExpense.deleteMany({ where: { crewGroupId: g.id } });
    await prisma.teamCrewGroupDayRoster.deleteMany({ where: { groupId: g.id } });
    await prisma.teamCrewGroupMember.deleteMany({ where: { groupId: g.id } });
    await prisma.crewStaffNotice.deleteMany({ where: { crewGroupId: g.id } });
  }
  stats.crewGroups = (await prisma.teamCrewGroup.deleteMany({ where: { tenantId: targetTenantId } })).count;

  await prisma.scheduleDayTeamMemberSlot.deleteMany({ where: { tenantId: targetTenantId } });
  await prisma.scheduleDayLeaderSlot.deleteMany({ where: { tenantId: targetTenantId } });
  await prisma.teamMemberDayOff.deleteMany({ where: { teamMember: { tenantId: targetTenantId } } });

  const extCos = await prisma.externalCompany.findMany({
    where: { tenantId: targetTenantId },
    select: { id: true },
  });
  const extIds = extCos.map((e) => e.id);
  if (extIds.length) {
    await prisma.externalCompanySettlementPayment.deleteMany({
      where: { externalCompanyId: { in: extIds } },
    });
    await prisma.externalCompanySettlementReset.deleteMany({
      where: { externalCompanyId: { in: extIds } },
    });
    await prisma.user.deleteMany({
      where: {
        tenantId: targetTenantId,
        role: 'EXTERNAL_PARTNER',
        email: { notIn: [...PRESERVE_TARGET_USER_EMAILS] },
      },
    });
    stats.externalCompanies = (
      await prisma.externalCompany.deleteMany({ where: { id: { in: extIds } } })
    ).count;
  }

  stats.teamMembers = (await prisma.teamMember.deleteMany({ where: { tenantId: targetTenantId } })).count;
  stats.teams = (await prisma.team.deleteMany({ where: { tenantId: targetTenantId } })).count;

  log(`[purge] 완료: ${JSON.stringify(stats)}`);
  return stats;
}
