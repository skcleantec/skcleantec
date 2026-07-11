import type { Prisma, PrismaClient } from '@prisma/client';
import type { InquiryExcelRowExecuteResult } from '../../lib/inquiryExcelImportPolicy.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { summarizeRowResults } from './inquiryExcelImport.runSummary.js';

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

export async function resolveDeletableInquiryIds(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  rowResults: InquiryExcelRowExecuteResult[],
): Promise<{
  ids: string[];
  pendingCreatedRows: number;
  missingInquiryIdRows: number;
  unresolvedRows: number;
}> {
  const ids = new Set<string>();
  let pendingCreatedRows = 0;
  let missingInquiryIdRows = 0;
  let unresolvedRows = 0;

  for (const row of rowResults) {
    if (row.kind !== 'CREATED') continue;
    pendingCreatedRows++;
    if (row.inquiryId) {
      ids.add(row.inquiryId);
      continue;
    }
    missingInquiryIdRows++;
    const num = row.inquiryNumber?.trim();
    if (!num) {
      unresolvedRows++;
      continue;
    }
    const found = await db.inquiry.findFirst({
      where: { tenantId, inquiryNumber: num },
      select: { id: true },
    });
    if (found) ids.add(found.id);
    else unresolvedRows++;
  }

  return {
    ids: [...ids],
    pendingCreatedRows,
    missingInquiryIdRows,
    unresolvedRows,
  };
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

/** inquiryId 또는 접수번호로 CREATED 행을 DELETED로 표시 */
export function markRowResultsDeletedResolved(
  rowResults: InquiryExcelRowExecuteResult[],
  deletedInquiryIds: Set<string>,
  inquiryNumberToId: Map<string, string>,
): InquiryExcelRowExecuteResult[] {
  return rowResults.map((row) => {
    if (row.kind !== 'CREATED') return row;
    const id =
      row.inquiryId ??
      (row.inquiryNumber?.trim() ? inquiryNumberToId.get(row.inquiryNumber.trim()) : undefined);
    if (id && deletedInquiryIds.has(id)) {
      return { ...row, kind: 'DELETED' as const, inquiryId: id };
    }
    return row;
  });
}

export async function deleteInquiriesFromExcelImportRun(params: {
  db: Prisma.TransactionClient;
  tenantId: string;
  runId: string;
  totalRows: number;
  actorId: string;
  rowResults: InquiryExcelRowExecuteResult[];
  runLabel: string;
}): Promise<{
  deletedCount: number;
  notFoundCount: number;
  alreadyDeletedCount: number;
  attemptedCount: number;
  missingInquiryIdRows: number;
  unresolvedRows: number;
}> {
  const alreadyDeletedCount = params.rowResults.filter((r) => r.kind === 'DELETED').length;
  const resolved = await resolveDeletableInquiryIds(params.db, params.tenantId, params.rowResults);

  if (resolved.pendingCreatedRows === 0) {
    return {
      deletedCount: 0,
      notFoundCount: 0,
      alreadyDeletedCount,
      attemptedCount: 0,
      missingInquiryIdRows: 0,
      unresolvedRows: 0,
    };
  }

  if (resolved.ids.length === 0) {
    return {
      deletedCount: 0,
      notFoundCount: 0,
      alreadyDeletedCount,
      attemptedCount: resolved.pendingCreatedRows,
      missingInquiryIdRows: resolved.missingInquiryIdRows,
      unresolvedRows: resolved.unresolvedRows,
    };
  }

  const inquiries = await params.db.inquiry.findMany({
    where: { tenantId: params.tenantId, id: { in: resolved.ids } },
    select: { id: true, customerName: true, inquiryNumber: true },
  });
  const foundIds = new Set(inquiries.map((i) => i.id));
  const notFoundCount = resolved.ids.filter((id) => !foundIds.has(id)).length;
  const inquiryNumberToId = new Map(
    inquiries
      .filter((i) => i.inquiryNumber)
      .map((i) => [i.inquiryNumber!.trim(), i.id] as const),
  );

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
  const nextRowResults = markRowResultsDeletedResolved(
    params.rowResults,
    deletedIds,
    inquiryNumberToId,
  );
  const summary = summarizeRowResults(nextRowResults, params.totalRows);
  await params.db.inquiryExcelImportRun.update({
    where: { id: params.runId },
    data: {
      rowResults: nextRowResults as unknown as Prisma.InputJsonValue,
      skippedCount: summary.skippedCount,
      errorCount: summary.errorCount,
    },
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
    attemptedCount: resolved.pendingCreatedRows,
    missingInquiryIdRows: resolved.missingInquiryIdRows,
    unresolvedRows: resolved.unresolvedRows,
  };
}
