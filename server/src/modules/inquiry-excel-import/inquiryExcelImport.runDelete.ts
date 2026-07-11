import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { InquiryExcelRowExecuteResult } from '../../lib/inquiryExcelImportPolicy.js';
import { notifyChangeLogToStaff } from '../realtime/changeLogNotify.js';
import { summarizeRowResults } from './inquiryExcelImport.runSummary.js';

/** 일괄 등록 되돌리기 — 트랜잭션당 삭제 건수(Prisma 5s 기본 타임아웃 회피) */
const UNDO_IMPORT_DELETE_BATCH_SIZE = 25;

const UNDO_IMPORT_TX_OPTIONS = {
  maxWait: 15_000,
  timeout: 120_000,
} as const;

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
  db: PrismaClient,
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

async function deleteInquiryBatch(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    actorId: string;
    runLabel: string;
    inquiries: Array<{ id: string; customerName: string; inquiryNumber: string | null }>;
  },
): Promise<void> {
  for (const inquiry of params.inquiries) {
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: inquiry.id,
        customerName: inquiry.customerName,
        actorId: params.actorId,
        lines: [
          `접수 삭제(일괄등록 실행 ${params.runLabel}): ${inquiry.customerName} (${inquiry.inquiryNumber ?? inquiry.id})`,
        ],
      },
    });
    await tx.inquiry.delete({ where: { id: inquiry.id } });
  }
}

async function persistRunRowResultsAfterDelete(params: {
  runId: string;
  rowResults: InquiryExcelRowExecuteResult[];
  totalRows: number;
}): Promise<void> {
  const summary = summarizeRowResults(params.rowResults, params.totalRows);
  await prisma.inquiryExcelImportRun.update({
    where: { id: params.runId },
    data: {
      rowResults: params.rowResults as unknown as Prisma.InputJsonValue,
      skippedCount: summary.skippedCount,
      errorCount: summary.errorCount,
    },
  });
}

export async function deleteInquiriesFromExcelImportRun(params: {
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
  const resolved = await resolveDeletableInquiryIds(prisma, params.tenantId, params.rowResults);

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

  const inquiries = await prisma.inquiry.findMany({
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

  const deletedIds = new Set<string>();
  let deletedCount = 0;

  try {
    for (let offset = 0; offset < inquiries.length; offset += UNDO_IMPORT_DELETE_BATCH_SIZE) {
      const batch = inquiries.slice(offset, offset + UNDO_IMPORT_DELETE_BATCH_SIZE);
      await prisma.$transaction(
        (tx) =>
          deleteInquiryBatch(tx, {
            tenantId: params.tenantId,
            actorId: params.actorId,
            runLabel: params.runLabel,
            inquiries: batch,
          }),
        UNDO_IMPORT_TX_OPTIONS,
      );
      for (const inquiry of batch) deletedIds.add(inquiry.id);
      deletedCount += batch.length;
    }
  } catch (e) {
    if (deletedCount > 0) {
      const partialRowResults = markRowResultsDeletedResolved(
        params.rowResults,
        deletedIds,
        inquiryNumberToId,
      );
      await persistRunRowResultsAfterDelete({
        runId: params.runId,
        rowResults: partialRowResults,
        totalRows: params.totalRows,
      });
    }
    const base = e instanceof Error ? e.message : '일괄 삭제 실패';
    throw new Error(`${base} (${deletedCount}건 삭제 후 중단)`);
  }

  const nextRowResults = markRowResultsDeletedResolved(
    params.rowResults,
    deletedIds,
    inquiryNumberToId,
  );
  await persistRunRowResultsAfterDelete({
    runId: params.runId,
    rowResults: nextRowResults,
    totalRows: params.totalRows,
  });

  if (deletedCount > 0) {
    notifyChangeLogToStaff({
      tenantId: params.tenantId,
      customerName: `일괄등록 ${params.runLabel}`,
      inquiryId: null,
      lines: [`일괄등록 실행으로 등록한 접수 ${deletedCount}건 삭제`],
    });
  }

  return {
    deletedCount,
    notFoundCount,
    alreadyDeletedCount,
    attemptedCount: resolved.pendingCreatedRows,
    missingInquiryIdRows: resolved.missingInquiryIdRows,
    unresolvedRows: resolved.unresolvedRows,
  };
}
