import type { InquiryExcelRowExecuteResult } from '../../lib/inquiryExcelImportPolicy.js';

export function mergeRowResults(
  existing: InquiryExcelRowExecuteResult[],
  batch: InquiryExcelRowExecuteResult[],
): InquiryExcelRowExecuteResult[] {
  const map = new Map<number, InquiryExcelRowExecuteResult>();
  for (const row of existing) map.set(row.rowIndex, row);
  for (const row of batch) map.set(row.rowIndex, row);
  return [...map.values()].sort((a, b) => a.rowIndex - b.rowIndex);
}

export function computeNextOffset(
  rowResults: InquiryExcelRowExecuteResult[],
  totalRows: number,
): number {
  const map = new Map(rowResults.map((row) => [row.rowIndex, row]));
  for (let i = 0; i < totalRows; i++) {
    const row = map.get(i + 2);
    if (!row || row.kind === 'ERROR') return i;
  }
  return totalRows;
}

export function summarizeRowResults(rowResults: InquiryExcelRowExecuteResult[], totalRows: number) {
  const createdCount = rowResults.filter((r) => r.kind === 'CREATED').length;
  const skippedCount = rowResults.filter((r) => r.kind === 'SKIPPED').length;
  const errorCount = rowResults.filter((r) => r.kind === 'ERROR').length;
  const deletedCount = rowResults.filter((r) => r.kind === 'DELETED').length;
  const remainingCreatedCount = rowResults.filter((r) => r.kind === 'CREATED').length;
  const processedRowCount = rowResults.length;
  const lastProcessedRowIndex = rowResults.reduce((max, r) => Math.max(max, r.rowIndex), 0);
  const pendingRowCount = Math.max(0, totalRows - processedRowCount);
  const nextOffset = computeNextOffset(rowResults, totalRows);
  const canResume = nextOffset < totalRows;
  return {
    createdCount,
    skippedCount,
    errorCount,
    deletedCount,
    remainingCreatedCount,
    processedRowCount,
    lastProcessedRowIndex,
    pendingRowCount,
    nextOffset,
    canResume,
  };
}

export function shouldSkipRowOnResume(row: InquiryExcelRowExecuteResult | undefined): boolean {
  if (!row) return false;
  if (row.kind === 'CREATED' || row.kind === 'SKIPPED' || row.kind === 'DELETED') return true;
  return false;
}
