import type { Prisma } from '@prisma/client';
import { parseBasicAnswers } from './inquiryInspection.validation.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

function serializePhoto(p: ChecklistRow['areas'][number]['items'][number]['photos'][number]) {
  return {
    id: p.id,
    phase: p.phase,
    secureUrl: p.secureUrl,
    width: p.width,
    height: p.height,
    flagged: p.flagged,
    uploadedBy: p.uploadedBy,
    createdAt: p.createdAt.toISOString(),
  };
}

export function serializeInspectionChecklist(row: ChecklistRow, inquiry?: {
  customerName: string;
  preferredDate: Date | null;
}) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    status: row.status,
    templateVersion: row.templateVersion,
    customerEmail: row.customerEmail,
    leaderNotes: row.leaderNotes,
    basicAnswers: parseBasicAnswers(row.basicAnswersJson),
    consent: {
      personalInfo: row.consentPersonalInfo,
      thirdParty: row.consentThirdParty,
      scopeConfirm: row.consentScopeConfirm,
      leaderLiability: row.consentLeaderLiability,
      customerConfirm: row.consentCustomerConfirm,
      commercialUse: row.consentCommercialUse,
      emailDelivery: row.consentEmailDelivery,
    },
    consentSnapshot: row.consentSnapshotJson,
    signature: row.signatureSecureUrl
      ? { publicId: row.signaturePublicId, secureUrl: row.signatureSecureUrl }
      : null,
    completedAt: row.completedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedBy: row.voidedBy ? { id: row.voidedBy.id, name: row.voidedBy.name } : null,
    voidReason: row.voidReason,
    emailSentAt: row.emailSentAt?.toISOString() ?? null,
    completionPdf: row.completionPdfSecureUrl
      ? { publicId: row.completionPdfPublicId, secureUrl: row.completionPdfSecureUrl }
      : null,
    customerViewToken: row.customerViewToken,
    teamLeader: row.teamLeader,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    areas: row.areas.map((a) => ({
      id: a.id,
      areaKey: a.areaKey,
      label: a.label,
      sortOrder: a.sortOrder,
      isCustom: a.isCustom,
      notApplicable: a.notApplicable,
      naReason: a.naReason,
      items: a.items.map((it) => ({
        id: it.id,
        itemKey: it.itemKey,
        label: it.label,
        sortOrder: it.sortOrder,
        isCustom: it.isCustom,
        notApplicable: it.notApplicable,
        naReason: it.naReason,
        photos: it.photos.map(serializePhoto),
      })),
    })),
    inquiryHeader: inquiry
      ? {
          customerName: inquiry.customerName,
          preferredDate: inquiry.preferredDate?.toISOString().slice(0, 10) ?? null,
        }
      : undefined,
  };
}
