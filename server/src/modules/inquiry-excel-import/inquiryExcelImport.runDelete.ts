import type { Prisma } from '@prisma/client';
import type { InquiryExcelRowExecuteResult } from '../../lib/inquiryExcelImportPolicy.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';

export function parseRowResults(raw: unknown): InquiryExcelRowExecuteResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => x as InquiryExcelRowExecuteResult);
}

export function collectDeletableInquiryIds(rowResults: InquiryExcelRowExecuteResult[]): string[] {
  const ids = new Set<string>();
  for (const row of rowResults) {
    if (row.kind === 'CREATED' && row.inquiryId) ids.add(row.inquiryId);
  }
  return [...ids];
}

export function countDeletedFromRowResults(rowResults: InquiryExcelRowExecuteResult[]): number {
  return rowResults.filter((r) => r.kind === 'DELETED').length;
}

export function markRowResultsDeleted(
  rowResults: InquiryExcelRowExecuteResult[],
  deletedInquiryIds: Set<string>,
): InquiryExcelRowExecuteResult[] {
  return rowResults.map((row) => {
    if (row.kind === 'CREATED' && row.inquiryId && deletedInquiryIds.has(row.inquiryId)) {
      return { ...row, kind: 'DELETED' as const };
    }
    return row;
  });
}

export async function deleteInquiriesFromExcelImportRun(params: {
  db: Prisma.TransactionClient;
  tenantId: string;
  runId: string;
  actorId: string;
  rowResults: InquiryExcelRowExecuteResult[];
  runLabel: string;
}): Promise<{ deletedCount: number; notFoundCount: number; alreadyDeletedCount: number }> {
  const inquiryIds = collectDeletableInquiryIds(params.rowResults);
  if (inquiryIds.length === 0) {
    return { deletedCount: 0, notFoundCount: 0, alreadyDeletedCount: 0 };
  }

  const alreadyDeletedCount = params.rowResults.filter((r) => r.kind === 'DELETED').length;
  const pendingIds = inquiryIds.filter((id) => {
    const row = params.rowResults.find((r) => r.inquiryId === id);
    return row?.kind === 'CREATED';
  });

  if (pendingIds.length === 0) {
    return { deletedCount: 0, notFoundCount: 0, alreadyDeletedCount };
  }

  const inquiries = await params.db.inquiry.findMany({
    where: { tenantId: params.tenantId, id: { in: pendingIds } },
    select: { id: true, customerName: true, inquiryNumber: true },
  });
  const foundIds = new Set(inquiries.map((i) => i.id));
  const notFoundCount = pendingIds.filter((id) => !foundIds.has(id)).length;

  for (const inquiry of inquiries) {
    await params.db.inquiryChangeLog.create({
      data: {
        inquiryId: inquiry.id,
        customerName: inquiry.customerName,
        actorId: params.actorId,
        lines: [
          `접수 삭제(일괄등록 실행 ${params.runLabel}): ${inquiry.customerName} (${inquiry.inquiryNumber ?? inquiry.id})`,
        ],
      },
    });
    await params.db.inquiry.delete({ where: { id: inquiry.id } });
  }

  const deletedIds = new Set(inquiries.map((i) => i.id));
  const nextRowResults = markRowResultsDeleted(params.rowResults, deletedIds);
  await params.db.inquiryExcelImportRun.update({
    where: { id: params.runId },
    data: { rowResults: nextRowResults as unknown as Prisma.InputJsonValue },
  });

  if (inquiries.length > 0) {
    notifyChangeLogToStaff({
      tenantId: params.tenantId,
      customerName: `일괄등록 ${params.runLabel}`,
      inquiryId: null,
      lines: [`일괄등록 실행으로 등록한 접수 ${inquiries.length}건 삭제`],
    });
  }

  return {
    deletedCount: inquiries.length,
    notFoundCount,
    alreadyDeletedCount,
  };
}
