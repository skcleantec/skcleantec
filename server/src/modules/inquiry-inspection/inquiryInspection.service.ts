import { InquiryInspectionStatus, InquiryStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { buildStandardInspectionAreas } from '../../lib/inquiryInspectionTemplate.js';
import { buildInspectionConsentSnapshot } from '../../lib/inquiryInspectionConsent.js';
import { inspectionChecklistInclude } from './inquiryInspection.include.js';
import { serializeInspectionChecklist } from './inquiryInspection.serialize.js';
import { validateInspectionCompletion } from './inquiryInspection.validation.js';
import { finalizeInspectionAfterComplete } from './inquiryInspection.postComplete.service.js';

function isEditableStatus(status: InquiryInspectionStatus): boolean {
  return status === InquiryInspectionStatus.IN_PROGRESS || status === InquiryInspectionStatus.AWAITING_CUSTOMER;
}

export async function getOrCreateInspectionChecklist(params: {
  inquiryId: string;
  tenantId: string;
  teamLeaderId: string;
  roomCount?: number | null;
  isOneRoom?: boolean | null;
  customerName: string;
  preferredDate: Date | null;
}) {
  const existing = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId: params.inquiryId, tenantId: params.tenantId },
    include: inspectionChecklistInclude,
  });
  if (existing) {
    return serializeInspectionChecklist(existing, {
      customerName: params.customerName,
      preferredDate: params.preferredDate,
    });
  }

  const areas = buildStandardInspectionAreas({
    roomCount: params.roomCount,
    isOneRoom: params.isOneRoom,
  });

  const created = await prisma.inquiryInspectionChecklist.create({
    data: {
      tenantId: params.tenantId,
      inquiryId: params.inquiryId,
      teamLeaderId: params.teamLeaderId,
      status: InquiryInspectionStatus.IN_PROGRESS,
      areas: {
        create: areas.map((a) => ({
          areaKey: a.areaKey,
          label: a.label,
          sortOrder: a.sortOrder,
          isCustom: false,
        })),
      },
    },
    include: inspectionChecklistInclude,
  });

  return serializeInspectionChecklist(created, {
    customerName: params.customerName,
    preferredDate: params.preferredDate,
  });
}

export async function loadInspectionChecklist(params: { inquiryId: string; tenantId: string }) {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId: params.inquiryId, tenantId: params.tenantId },
    include: inspectionChecklistInclude,
  });
  if (!row) return null;
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: { customerName: true, preferredDate: true },
  });
  return serializeInspectionChecklist(row, inquiry ?? undefined);
}

export async function updateInspectionDraft(params: {
  checklistId: string;
  tenantId: string;
  patch: {
    leaderNotes?: string | null;
    customerEmail?: string | null;
    basicAnswersJson?: Prisma.InputJsonValue;
    consentPersonalInfo?: boolean;
    consentThirdParty?: boolean;
    consentScopeConfirm?: boolean;
    consentLeaderLiability?: boolean;
    consentCustomerConfirm?: boolean;
    consentCommercialUse?: boolean;
    consentEmailDelivery?: boolean;
    signaturePublicId?: string | null;
    signatureSecureUrl?: string | null;
  };
}) {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
  });
  if (!row) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (!isEditableStatus(row.status)) {
    throw Object.assign(new Error('locked'), { code: 'locked' as const });
  }

  const data: Prisma.InquiryInspectionChecklistUpdateInput = {};
  if ('leaderNotes' in params.patch) data.leaderNotes = params.patch.leaderNotes;
  if ('customerEmail' in params.patch) data.customerEmail = params.patch.customerEmail;
  if ('basicAnswersJson' in params.patch) data.basicAnswersJson = params.patch.basicAnswersJson;
  if ('consentPersonalInfo' in params.patch) data.consentPersonalInfo = params.patch.consentPersonalInfo;
  if ('consentThirdParty' in params.patch) data.consentThirdParty = params.patch.consentThirdParty;
  if ('consentScopeConfirm' in params.patch) data.consentScopeConfirm = params.patch.consentScopeConfirm;
  if ('consentLeaderLiability' in params.patch) data.consentLeaderLiability = params.patch.consentLeaderLiability;
  if ('consentCustomerConfirm' in params.patch) data.consentCustomerConfirm = params.patch.consentCustomerConfirm;
  if ('consentCommercialUse' in params.patch) data.consentCommercialUse = params.patch.consentCommercialUse;
  if ('consentEmailDelivery' in params.patch) data.consentEmailDelivery = params.patch.consentEmailDelivery;
  if ('signaturePublicId' in params.patch) data.signaturePublicId = params.patch.signaturePublicId;
  if ('signatureSecureUrl' in params.patch) data.signatureSecureUrl = params.patch.signatureSecureUrl;

  const updated = await prisma.inquiryInspectionChecklist.update({
    where: { id: row.id },
    data,
    include: inspectionChecklistInclude,
  });
  return updated;
}

export async function addCustomInspectionArea(params: {
  checklistId: string;
  tenantId: string;
  label: string;
}) {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
    include: { areas: { select: { sortOrder: true, areaKey: true } } },
  });
  if (!row) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (!isEditableStatus(row.status)) throw Object.assign(new Error('locked'), { code: 'locked' as const });

  const label = params.label.trim().slice(0, 120);
  if (!label) throw Object.assign(new Error('label_required'), { code: 'bad_request' as const });

  const maxSort = row.areas.reduce((m, a) => Math.max(m, a.sortOrder), -1);
  const customIndex = row.areas.filter((a) => a.areaKey.startsWith('custom_')).length + 1;
  const areaKey = `custom_${customIndex}_${Date.now()}`;

  return prisma.inquiryInspectionArea.create({
    data: {
      checklistId: row.id,
      areaKey,
      label,
      sortOrder: maxSort + 1,
      isCustom: true,
    },
  });
}

export async function patchInspectionArea(params: {
  checklistId: string;
  tenantId: string;
  areaId: string;
  notApplicable?: boolean;
  naReason?: string | null;
}) {
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
  });
  if (!checklist) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (!isEditableStatus(checklist.status)) throw Object.assign(new Error('locked'), { code: 'locked' as const });

  const area = await prisma.inquiryInspectionArea.findFirst({
    where: { id: params.areaId, checklistId: checklist.id },
  });
  if (!area) throw Object.assign(new Error('area_not_found'), { code: 'not_found' as const });

  const data: Prisma.InquiryInspectionAreaUpdateInput = {};
  if (typeof params.notApplicable === 'boolean') {
    data.notApplicable = params.notApplicable;
    if (params.notApplicable) {
      data.naReason = params.naReason?.trim().slice(0, 500) ?? null;
    } else {
      data.naReason = null;
    }
  } else if ('naReason' in params) {
    data.naReason = params.naReason?.trim().slice(0, 500) ?? null;
  }

  return prisma.inquiryInspectionArea.update({ where: { id: area.id }, data });
}

export async function completeInspectionChecklist(params: {
  checklistId: string;
  tenantId: string;
  inquiryId: string;
}) {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId, inquiryId: params.inquiryId },
    include: inspectionChecklistInclude,
  });
  if (!row) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (row.status === InquiryInspectionStatus.COMPLETED) {
    throw Object.assign(new Error('already_completed'), { code: 'already_completed' as const });
  }
  if (row.status === InquiryInspectionStatus.VOID) {
    throw Object.assign(new Error('voided'), { code: 'voided' as const });
  }

  const issues = validateInspectionCompletion(row);
  if (issues.length) {
    throw Object.assign(new Error('validation_failed'), { code: 'validation_failed' as const, issues });
  }

  const snapshot = buildInspectionConsentSnapshot();
  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.inquiryInspectionChecklist.update({
      where: { id: row.id },
      data: {
        status: InquiryInspectionStatus.COMPLETED,
        completedAt: now,
        consentSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
      },
      include: inspectionChecklistInclude,
    }),
    prisma.inquiry.updateMany({
      where: {
        id: params.inquiryId,
        tenantId: params.tenantId,
        status: { in: [InquiryStatus.ASSIGNED, InquiryStatus.IN_PROGRESS] },
      },
      data: { status: InquiryStatus.COMPLETED },
    }),
  ]);

  // 이메일·PDF는 완료 트랜잭션 직후 비동기 후처리
  void finalizeInspectionAfterComplete({
    checklistId: updated.id,
    tenantId: params.tenantId,
    inquiryId: params.inquiryId,
  }).catch((e) => console.error('[inspection] post-complete failed', e));

  return serializeInspectionChecklist(updated);
}

export async function voidInspectionChecklist(params: {
  checklistId: string;
  tenantId: string;
  voidedById: string;
  voidReason: string;
}) {
  const reason = params.voidReason.trim();
  if (!reason) throw Object.assign(new Error('reason_required'), { code: 'bad_request' as const });

  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
  });
  if (!row) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (row.status !== InquiryInspectionStatus.COMPLETED) {
    throw Object.assign(new Error('not_completed'), { code: 'bad_request' as const });
  }

  const updated = await prisma.inquiryInspectionChecklist.update({
    where: { id: row.id },
    data: {
      status: InquiryInspectionStatus.VOID,
      voidedAt: new Date(),
      voidedById: params.voidedById,
      voidReason: reason,
    },
    include: inspectionChecklistInclude,
  });
  return serializeInspectionChecklist(updated);
}

export async function assertChecklistEditableForTeam(params: {
  inquiryId: string;
  tenantId: string;
}) {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId: params.inquiryId, tenantId: params.tenantId },
  });
  if (row && !isEditableStatus(row.status)) {
    throw Object.assign(new Error('locked'), { code: 'locked' as const });
  }
  return row;
}
