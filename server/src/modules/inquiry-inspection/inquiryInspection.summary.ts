import type { InquiryInspectionStatus, Prisma } from '@prisma/client';
import { countItemPhotoProgress, isItemComplete } from '../../lib/inquiryInspectionTemplate.js';
import type { inspectionChecklistListInclude } from './inquiryInspection.listInclude.js';

export type InspectionListSummary = {
  status: InquiryInspectionStatus;
  completedAt: string | null;
  emailSentAt: string | null;
  hasPdf: boolean;
  beforeDone: number;
  beforeTotal: number;
  afterDone: number;
  afterTotal: number;
  /** 청소 전·후 모두 충족(또는 NA)된 항목 수 */
  itemsComplete: number;
  itemsTotal: number;
};

type ChecklistForSummary = {
  status: InquiryInspectionStatus;
  completedAt: Date | null;
  emailSentAt: Date | null;
  completionPdfSecureUrl: string | null;
  areas: Array<{
    notApplicable: boolean;
    items: Array<{
      itemKey: string;
      notApplicable: boolean;
      naReason: string | null;
      photos: Array<{ phase: 'BEFORE' | 'AFTER' }>;
    }>;
  }>;
};

function collectItemStats(checklist: ChecklistForSummary) {
  const stats: Array<{
    notApplicable: boolean;
    naReason: string | null;
    beforeCount: number;
    afterCount: number;
  }> = [];

  for (const area of checklist.areas) {
    if (area.notApplicable) continue;
    for (const item of area.items) {
      if (item.itemKey.startsWith('_')) continue;
      stats.push({
        notApplicable: item.notApplicable,
        naReason: item.naReason,
        beforeCount: item.photos.filter((p) => p.phase === 'BEFORE').length,
        afterCount: item.photos.filter((p) => p.phase === 'AFTER').length,
      });
    }
  }
  return stats;
}

export function computeInspectionListSummary(checklist: ChecklistForSummary): InspectionListSummary {
  const stats = collectItemStats(checklist);
  const progress = countItemPhotoProgress(stats);
  let itemsComplete = 0;
  for (const it of stats) {
    if (isItemComplete(it)) itemsComplete += 1;
  }

  return {
    status: checklist.status,
    completedAt: checklist.completedAt?.toISOString() ?? null,
    emailSentAt: checklist.emailSentAt?.toISOString() ?? null,
    hasPdf: Boolean(checklist.completionPdfSecureUrl?.trim()),
    beforeDone: progress.beforeDone,
    beforeTotal: progress.total,
    afterDone: progress.afterDone,
    afterTotal: progress.total,
    itemsComplete,
    itemsTotal: progress.total,
  };
}

export function attachInspectionSummaryToInquiry<T extends { inspectionChecklist?: ChecklistForSummary | null }>(
  row: T,
): Omit<T, 'inspectionChecklist'> & { inspectionSummary: InspectionListSummary | null } {
  const { inspectionChecklist, ...rest } = row;
  return {
    ...rest,
    inspectionSummary: inspectionChecklist ? computeInspectionListSummary(inspectionChecklist) : null,
  };
}

export function attachInspectionSummaries<T extends { inspectionChecklist?: ChecklistForSummary | null }>(
  rows: T[],
): Array<Omit<T, 'inspectionChecklist'> & { inspectionSummary: InspectionListSummary | null }> {
  return rows.map((row) => attachInspectionSummaryToInquiry(row));
}

/** 관리자 목록 필터: NONE | IN_PROGRESS(미완료) | COMPLETED | VOID */
export function whereInspectionStatusFilter(raw: string): Prisma.InquiryWhereInput | null {
  const v = raw.trim().toUpperCase();
  if (v === 'NONE') return { inspectionChecklist: { is: null } };
  if (v === 'IN_PROGRESS') {
    return {
      inspectionChecklist: {
        is: { status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'AWAITING_CUSTOMER'] } },
      },
    };
  }
  if (v === 'COMPLETED') return { inspectionChecklist: { is: { status: 'COMPLETED' } } };
  if (v === 'MISSED') return { inspectionChecklist: { is: { status: 'MISSED' } } };
  if (v === 'VOID') return { inspectionChecklist: { is: { status: 'VOID' } } };
  return null;
}
