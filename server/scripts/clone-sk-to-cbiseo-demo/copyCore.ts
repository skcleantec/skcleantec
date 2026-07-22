import type { Prisma } from '@prisma/client';
import type { CloneContext, CloneStats } from './types.js';
import { mapExternalCompanyId, mapTeamMemberId, targetOcId } from './copyMaster.js';

function strip<T extends Record<string, unknown>>(row: T, omit: (keyof T)[]): Omit<T, (typeof omit)[number]> {
  const out = { ...row };
  for (const k of omit) delete out[k];
  return out as Omit<T, (typeof omit)[number]>;
}

export async function copyCoreInquiries(ctx: CloneContext): Promise<CloneStats> {
  const { prisma, sourceTenantId, sourceOcIds, fromDate, dryRun, ids, anonymizer, users, log } = ctx;
  const stats: CloneStats = { inquiries: 0, orderForms: 0, assignments: 0 };

  const rows = await prisma.inquiry.findMany({
    where: {
      tenantId: sourceTenantId,
      operatingCompanyId: { in: sourceOcIds },
      createdAt: { gte: fromDate },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      orderForm: {
        include: {
          photos: true,
          submissionEmailLog: true,
          reviewPaybackRequest: true,
        },
      },
      assignments: true,
      changeLogs: true,
      statusEvents: true,
      extraCharges: true,
      additionalReceipts: true,
      consultationPhotos: true,
      cleaningPhotos: true,
      crewMemberMeetingTimes: true,
      inspectionChecklist: {
        include: {
          areas: { include: { items: { include: { photos: true } } } },
        },
      },
    },
  });

  log(`[core] 복사 대상 접수 ${rows.length}건`);
  if (dryRun) {
    stats.inquiries = rows.length;
    stats.orderForms = rows.filter((r) => r.orderForm).length;
    stats.assignments = rows.reduce((n, r) => n + r.assignments.length, 0);
    return stats;
  }

  const userIds = new Set<string>();
  for (const inq of rows) {
    if (inq.createdById) userIds.add(inq.createdById);
    if (inq.collaborationMarketerId) userIds.add(inq.collaborationMarketerId);
    if (inq.deletedById) userIds.add(inq.deletedById);
    if (inq.orderForm?.createdById) userIds.add(inq.orderForm.createdById);
    for (const a of inq.assignments) {
      userIds.add(a.teamLeaderId);
      userIds.add(a.assignedById);
    }
    for (const c of inq.extraCharges) if (c.createdById) userIds.add(c.createdById);
    for (const r of inq.additionalReceipts) if (r.createdById) userIds.add(r.createdById);
    for (const p of inq.consultationPhotos) userIds.add(p.uploadedById);
    for (const p of inq.cleaningPhotos) if (p.uploadedById) userIds.add(p.uploadedById);
    for (const logRow of inq.changeLogs) if (logRow.actorId) userIds.add(logRow.actorId);
    for (const ev of inq.statusEvents) if (ev.actorId) userIds.add(ev.actorId);
  }
  await users.preloadFromIds(prisma, userIds);

  for (const inq of rows) {
    const newInqId = ids.assign(inq.id);
    const ocId = targetOcId(ctx, inq.operatingCompanyId);
    let newOrderFormId: string | null = null;

    if (inq.orderForm) {
      const of = inq.orderForm;
      newOrderFormId = ids.assign(of.id);
      const ofOc = of.operatingCompanyId ? targetOcId(ctx, of.operatingCompanyId) : ocId;
      await prisma.orderForm.create({
        data: {
          ...strip(of as unknown as Record<string, unknown>, [
            'photos',
            'submissionEmailLog',
            'reviewPaybackRequest',
            'inquiries',
            'tenant',
            'operatingCompany',
            'createdBy',
            'template',
          ]) as Prisma.OrderFormUncheckedCreateInput,
          id: newOrderFormId,
          tenantId: ctx.targetTenantId,
          operatingCompanyId: ofOc,
          token: anonymizer.newToken('cbof', of.id),
          customerName: anonymizer.demoCustomerName(of.id),
          customerPhone: anonymizer.demoPhone(of.id),
          customerEmail: anonymizer.demoEmail(of.id),
          customerSpecialNotes: anonymizer.scrubText(of.customerSpecialNotes),
          optionNote: anonymizer.scrubText(of.optionNote),
          createdById: users.map(of.createdById, 'MARKETER'),
        },
      });
      stats.orderForms = (stats.orderForms ?? 0) + 1;

      for (const p of of.photos) {
        const photo = anonymizer.dummyPhoto(p.id);
        await prisma.orderFormPhoto.create({
          data: {
            id: ids.assign(p.id),
            orderFormId: newOrderFormId,
            cloudinaryPublicId: photo.publicId,
            secureUrl: photo.url,
            width: p.width,
            height: p.height,
            createdAt: p.createdAt,
          },
        });
      }

      if (of.submissionEmailLog) {
        const logRow = of.submissionEmailLog;
        await prisma.orderFormSubmissionEmailLog.create({
          data: {
            id: ids.assign(logRow.id),
            tenantId: ctx.targetTenantId,
            orderFormId: newOrderFormId,
            operatingCompanyId: ofOc,
            toEmail: anonymizer.demoEmail(of.id),
            status: logRow.status,
            attemptCount: logRow.attemptCount,
            lastError: anonymizer.scrubText(logRow.lastError),
            sentAt: logRow.sentAt,
            createdAt: logRow.createdAt,
            updatedAt: logRow.updatedAt,
          },
        });
      }
    }

    await prisma.inquiry.create({
      data: {
        ...strip(inq as unknown as Record<string, unknown>, [
          'orderForm',
          'assignments',
          'changeLogs',
          'statusEvents',
          'extraCharges',
          'additionalReceipts',
          'consultationPhotos',
          'cleaningPhotos',
          'crewMemberMeetingTimes',
          'inspectionChecklist',
          'createdBy',
          'collaborationMarketer',
          'deletedBy',
          'cancelFeeExternalCompany',
          'operatingCompany',
          'tenant',
        ]) as Prisma.InquiryUncheckedCreateInput,
        id: newInqId,
        tenantId: ctx.targetTenantId,
        operatingCompanyId: ocId,
        inquiryNumber: anonymizer.remapInquiryNumber(inq.inquiryNumber, newInqId),
        customerName: anonymizer.demoCustomerName(inq.id),
        nickname: inq.nickname ? anonymizer.demoCustomerName(`${inq.id}:nick`) : null,
        customerPhone: anonymizer.demoPhone(inq.id),
        customerPhone2: inq.customerPhone2 ? anonymizer.demoPhone(`${inq.id}:2`) : null,
        customerEmail: anonymizer.demoEmail(inq.id),
        address: anonymizer.demoAddress(inq.id),
        addressDetail: anonymizer.demoAddressDetail(),
        addressGeoQuery: null,
        addressGeoLat: null,
        addressGeoLng: null,
        memo: anonymizer.scrubText(inq.memo),
        claimMemo: anonymizer.scrubText(inq.claimMemo),
        consultationMemo: anonymizer.scrubText(inq.consultationMemo),
        scheduleMemo: anonymizer.scrubText(inq.scheduleMemo),
        crewMemberNote: anonymizer.scrubText(inq.crewMemberNote),
        specialNotes: anonymizer.scrubText(inq.specialNotes),
        orderFormId: newOrderFormId,
        createdById: users.mapOptional(inq.createdById, 'MARKETER'),
        collaborationMarketerId: users.mapOptional(inq.collaborationMarketerId, 'MARKETER'),
        deletedById: users.mapOptional(inq.deletedById, 'ADMIN'),
        cancelFeeExternalCompanyId: mapExternalCompanyId(ctx, inq.cancelFeeExternalCompanyId),
      },
    });
    stats.inquiries = (stats.inquiries ?? 0) + 1;

    for (const a of inq.assignments) {
      await prisma.assignment.create({
        data: {
          id: ids.assign(a.id),
          tenantId: ctx.targetTenantId,
          inquiryId: newInqId,
          teamLeaderId: users.map(a.teamLeaderId, 'TEAM_LEADER'),
          assignedById: users.map(a.assignedById, 'ADMIN'),
          assignedAt: a.assignedAt,
          detailViewedAt: a.detailViewedAt,
          sortOrder: a.sortOrder,
          noCrewMembers: a.noCrewMembers,
        },
      });
      stats.assignments = (stats.assignments ?? 0) + 1;
    }

    for (const logRow of inq.changeLogs) {
      const scrubbedLines = scrubJsonLines(logRow.lines, anonymizer);
      await prisma.inquiryChangeLog.create({
        data: {
          id: ids.assign(logRow.id),
          inquiryId: newInqId,
          customerName: anonymizer.demoCustomerName(inq.id),
          actorId: users.mapOptional(logRow.actorId, 'ADMIN'),
          lines: scrubbedLines,
          createdAt: logRow.createdAt,
        },
      });
    }

    for (const ev of inq.statusEvents) {
      await prisma.inquiryStatusEvent.create({
        data: {
          id: ids.assign(ev.id),
          tenantId: ctx.targetTenantId,
          inquiryId: newInqId,
          status: ev.status,
          actorId: users.mapOptional(ev.actorId, 'ADMIN'),
          occurredAt: ev.occurredAt,
        },
      });
    }

    for (const c of inq.extraCharges) {
      await prisma.inquiryExtraCharge.create({
        data: {
          id: ids.assign(c.id),
          inquiryId: newInqId,
          description: anonymizer.scrubText(c.description) ?? c.description,
          amount: c.amount,
          sortOrder: c.sortOrder,
          createdById: users.mapOptional(c.createdById, 'ADMIN'),
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        },
      });
    }

    for (const r of inq.additionalReceipts) {
      await prisma.inquiryAdditionalReceipt.create({
        data: {
          id: ids.assign(r.id),
          inquiryId: newInqId,
          description: anonymizer.scrubText(r.description) ?? r.description,
          amount: r.amount,
          settlementChannel: r.settlementChannel,
          sortOrder: r.sortOrder,
          createdById: users.mapOptional(r.createdById, 'ADMIN'),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        },
      });
    }

    for (const p of inq.consultationPhotos) {
      const photo = anonymizer.dummyPhoto(p.id);
      await prisma.inquiryConsultationPhoto.create({
        data: {
          id: ids.assign(p.id),
          inquiryId: newInqId,
          cloudinaryPublicId: photo.publicId,
          secureUrl: photo.url,
          width: p.width,
          height: p.height,
          uploadedById: users.map(p.uploadedById, 'MARKETER'),
          createdAt: p.createdAt,
        },
      });
    }

    for (const p of inq.cleaningPhotos) {
      const photo = anonymizer.dummyPhoto(p.id);
      await prisma.inquiryCleaningPhoto.create({
        data: {
          id: ids.assign(p.id),
          inquiryId: newInqId,
          phase: p.phase,
          cloudinaryPublicId: photo.publicId,
          secureUrl: photo.url,
          width: p.width,
          height: p.height,
          uploadedById: users.map(p.uploadedById, 'TEAM_LEADER'),
          createdAt: p.createdAt,
        },
      });
    }

    for (const mt of inq.crewMemberMeetingTimes) {
      const tmId = mapTeamMemberId(ctx, mt.teamMemberId);
      if (!tmId) continue;
      await prisma.inquiryCrewMemberMeetingTime.create({
        data: {
          id: ids.assign(mt.id),
          tenantId: ctx.targetTenantId,
          inquiryId: newInqId,
          teamMemberId: tmId,
          meetingTime: mt.meetingTime,
          updatedAt: mt.updatedAt,
        },
      });
    }

    if (inq.inspectionChecklist) {
      const chk = inq.inspectionChecklist;
      const newChkId = ids.assign(chk.id);
      const sig = anonymizer.dummyPhoto(`${chk.id}:sig`);
      await prisma.inquiryInspectionChecklist.create({
        data: {
          id: newChkId,
          tenantId: ctx.targetTenantId,
          inquiryId: newInqId,
          teamLeaderId: users.map(chk.teamLeaderId, 'TEAM_LEADER'),
          status: chk.status,
          templateVersion: chk.templateVersion,
          customerEmail: anonymizer.demoEmail(inq.id),
          leaderNotes: anonymizer.scrubText(chk.leaderNotes),
          basicAnswersJson: chk.basicAnswersJson ?? {},
          consentSnapshotJson: chk.consentSnapshotJson ?? undefined,
          consentPersonalInfo: chk.consentPersonalInfo,
          consentThirdParty: chk.consentThirdParty,
          consentScopeConfirm: chk.consentScopeConfirm,
          consentLeaderLiability: chk.consentLeaderLiability,
          consentCustomerConfirm: chk.consentCustomerConfirm,
          consentCommercialUse: chk.consentCommercialUse,
          consentEmailDelivery: chk.consentEmailDelivery,
          signaturePublicId: sig.publicId,
          signatureSecureUrl: sig.url,
          completedAt: chk.completedAt,
          voidedAt: chk.voidedAt,
          voidedById: users.mapOptional(chk.voidedById, 'ADMIN'),
          voidReason: anonymizer.scrubText(chk.voidReason),
          emailSentAt: chk.emailSentAt,
          completionPdfPublicId: chk.completionPdfPublicId ? sig.publicId : null,
          completionPdfSecureUrl: chk.completionPdfSecureUrl ? sig.url : null,
          customerViewToken: chk.customerViewToken
            ? anonymizer.newToken('cbinsp', chk.id)
            : null,
          createdAt: chk.createdAt,
          updatedAt: chk.updatedAt,
        },
      });
      for (const area of chk.areas) {
        const newAreaId = ids.assign(area.id);
        await prisma.inquiryInspectionArea.create({
          data: {
            id: newAreaId,
            checklistId: newChkId,
            areaKey: area.areaKey,
            label: area.label,
            sortOrder: area.sortOrder,
            isCustom: area.isCustom,
            notApplicable: area.notApplicable,
            naReason: anonymizer.scrubText(area.naReason),
          },
        });
        for (const item of area.items) {
          const newItemId = ids.assign(item.id);
          await prisma.inquiryInspectionItem.create({
            data: {
              id: newItemId,
              areaId: newAreaId,
              itemKey: item.itemKey,
              label: item.label,
              sortOrder: item.sortOrder,
              isCustom: item.isCustom,
              notApplicable: item.notApplicable,
              naReason: anonymizer.scrubText(item.naReason),
            },
          });
          for (const photo of item.photos) {
            const dummy = anonymizer.dummyPhoto(photo.id);
            await prisma.inquiryInspectionAreaPhoto.create({
              data: {
                id: ids.assign(photo.id),
                itemId: newItemId,
                phase: photo.phase,
                cloudinaryPublicId: dummy.publicId,
                secureUrl: dummy.url,
                width: photo.width,
                height: photo.height,
                uploadedById: users.map(photo.uploadedById, 'TEAM_LEADER'),
                createdAt: photo.createdAt,
                flagged: photo.flagged,
              },
            });
          }
        }
      }
    }
  }

  log(`[core] 완료 inquiries=${stats.inquiries} orderForms=${stats.orderForms} assignments=${stats.assignments}`);
  return stats;
}

function scrubJsonLines(lines: unknown, anonymizer: import('./anonymize.js').Anonymizer): unknown {
  if (Array.isArray(lines)) {
    return lines.map((line) =>
      typeof line === 'string' ? anonymizer.scrubText(line) ?? line : line,
    );
  }
  if (lines && typeof lines === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(lines as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? anonymizer.scrubText(v) ?? v : v;
    }
    return out;
  }
  return lines;
}
