import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { INQUIRY_EXCEL_IMPORT_BATCH_SIZE } from '../../lib/inquiryExcelImportPolicy.js';
import type {
  InquiryExcelMappingSpec,
  InquiryExcelRowExecuteResult,
} from '../../lib/inquiryExcelImportPolicy.js';
import { createInquiryFromBody, InquiryCreateError } from '../inquiries/inquiryCreate.service.js';
import { findDuplicateInquiry } from './inquiryExcelImport.duplicate.js';
import { mapExcelRowToInquiryBody } from './inquiryExcelImport.map.js';
import { parseExcelBuffer, type ParsedExcelSheet } from './inquiryExcelImport.parse.js';
import { parseRowResults } from './inquiryExcelImport.runDelete.js';
import {
  mergeRowResults,
  shouldSkipRowOnResume,
  summarizeRowResults,
} from './inquiryExcelImport.runSummary.js';
import { parseMappingSpec } from './inquiryExcelImport.spec.js';

async function processOneExecuteRow(params: {
  tenantId: string;
  spec: InquiryExcelMappingSpec;
  excelRow: Record<string, string>;
  rowIndex: number;
  userId: string;
  userRole: UserRole;
}): Promise<InquiryExcelRowExecuteResult> {
  const mapped = await mapExcelRowToInquiryBody({
    db: prisma,
    tenantId: params.tenantId,
    spec: params.spec,
    excelRow: params.excelRow,
  });

  if (mapped.error) {
    return { rowIndex: params.rowIndex, kind: 'ERROR', message: mapped.error };
  }
  if (mapped.skipReason) {
    return { rowIndex: params.rowIndex, kind: 'SKIPPED', message: mapped.skipReason };
  }

  const dup = await findDuplicateInquiry({
    db: prisma,
    tenantId: params.tenantId,
    inquiryNumber: String(mapped.body.inquiryNumber ?? ''),
    customerName: String(mapped.body.customerName ?? ''),
    customerPhone: String(mapped.body.customerPhone ?? ''),
    preferredDate:
      mapped.body.preferredDate != null ? String(mapped.body.preferredDate) : null,
    address: mapped.body.address != null ? String(mapped.body.address) : null,
  });
  if (dup) {
    return {
      rowIndex: params.rowIndex,
      kind: 'SKIPPED',
      message: `중복 — 기존 접수와 일치 (#${dup.inquiryNumber ?? dup.id.slice(0, 8)})`,
    };
  }

  try {
    const created = await createInquiryFromBody({
      tenantId: params.tenantId,
      userId: params.userId,
      userRole: params.userRole,
      body: mapped.body,
      inquiryNumberOverride: mapped.body.inquiryNumber
        ? String(mapped.body.inquiryNumber)
        : null,
    });
    return {
      rowIndex: params.rowIndex,
      kind: 'CREATED',
      inquiryId: created.id,
      inquiryNumber: created.inquiryNumber,
    };
  } catch (e) {
    const msg =
      e instanceof InquiryCreateError
        ? e.message
        : e instanceof Error
          ? e.message
          : '접수 생성 실패';
    return { rowIndex: params.rowIndex, kind: 'ERROR', message: msg };
  }
}

export async function executeInquiryExcelImportBatch(params: {
  tenantId: string;
  userId: string;
  userRole: UserRole;
  profileId: string;
  buffer: Buffer;
  fileName?: string;
  runId?: string;
  startOffset?: number;
  batchSize?: number;
}) {
  const profile = await prisma.inquiryExcelImportProfile.findFirst({
    where: { id: params.profileId, tenantId: params.tenantId, isActive: true },
  });
  if (!profile) throw new Error('매칭 서식을 찾을 수 없습니다.');
  const spec = parseMappingSpec(profile.mappingSpec);
  const sheet: ParsedExcelSheet = parseExcelBuffer(params.buffer, params.fileName);
  const batchSize = Math.min(
    200,
    Math.max(1, params.batchSize ?? INQUIRY_EXCEL_IMPORT_BATCH_SIZE),
  );
  const startOffset = Math.max(0, Math.min(params.startOffset ?? 0, sheet.rows.length));

  let runId = params.runId?.trim() || '';
  let existingResults: InquiryExcelRowExecuteResult[] = [];

  if (runId) {
    const existingRun = await prisma.inquiryExcelImportRun.findFirst({
      where: { id: runId, tenantId: params.tenantId },
    });
    if (!existingRun) throw new Error('이어서 등록할 실행 이력을 찾을 수 없습니다.');
    if (existingRun.status === 'COMPLETED') {
      const summary = summarizeRowResults(parseRowResults(existingRun.rowResults), existingRun.totalRows);
      return {
        fileName: params.fileName,
        totalRows: existingRun.totalRows,
        runId: existingRun.id,
        done: true,
        batchSize,
        ...summary,
        rows: [] as InquiryExcelRowExecuteResult[],
        status: existingRun.status,
      };
    }
    existingResults = parseRowResults(existingRun.rowResults);
  } else {
    const run = await prisma.inquiryExcelImportRun.create({
      data: {
        tenantId: params.tenantId,
        profileId: params.profileId,
        fileName: params.fileName ?? null,
        totalRows: sheet.rows.length,
        createdCount: 0,
        skippedCount: 0,
        errorCount: 0,
        rowResults: [] as unknown as Prisma.InputJsonValue,
        status: 'RUNNING',
        actorId: params.userId,
      },
    });
    runId = run.id;
  }

  const resultByIndex = new Map<number, InquiryExcelRowExecuteResult>(
    existingResults.map((row) => [row.rowIndex, row]),
  );

  const batchResults: InquiryExcelRowExecuteResult[] = [];
  const end = Math.min(startOffset + batchSize, sheet.rows.length);

  try {
    for (let i = startOffset; i < end; i++) {
      const rowIndex = i + 2;
      const prev = resultByIndex.get(rowIndex);
      if (shouldSkipRowOnResume(prev)) {
        continue;
      }

      const rowResult = await processOneExecuteRow({
        tenantId: params.tenantId,
        spec,
        excelRow: sheet.rows[i]!,
        rowIndex,
        userId: params.userId,
        userRole: params.userRole,
      });
      resultByIndex.set(rowIndex, rowResult);
      batchResults.push(rowResult);
    }

    const merged = mergeRowResults(existingResults, batchResults);
    const summary = summarizeRowResults(merged, sheet.rows.length);

    let nextOffset = sheet.rows.length;
    for (let i = 0; i < sheet.rows.length; i++) {
      const rowIndex = i + 2;
      const row = resultByIndex.get(rowIndex);
      if (!row || row.kind === 'ERROR') {
        nextOffset = i;
        break;
      }
    }
    const done = nextOffset >= sheet.rows.length;
    const status = done ? 'COMPLETED' : 'RUNNING';

    await prisma.inquiryExcelImportRun.update({
      where: { id: runId },
      data: {
        createdCount: summary.createdCount,
        skippedCount: summary.skippedCount,
        errorCount: summary.errorCount,
        rowResults: merged as unknown as Prisma.InputJsonValue,
        status,
      },
    });

    return {
      fileName: params.fileName,
      totalRows: sheet.rows.length,
      runId,
      done,
      batchSize,
      ...summary,
      rows: batchResults,
      status,
    };
  } catch (e) {
    const merged = mergeRowResults(existingResults, batchResults);
    const summary = summarizeRowResults(merged, sheet.rows.length);
    await prisma.inquiryExcelImportRun.update({
      where: { id: runId },
      data: {
        createdCount: summary.createdCount,
        skippedCount: summary.skippedCount,
        errorCount: summary.errorCount,
        rowResults: merged as unknown as Prisma.InputJsonValue,
        status: 'FAILED',
      },
    });
    const msg = e instanceof Error ? e.message : '일괄 등록 실패';
    throw new Error(`${msg} (실행 ID: ${runId}, 마지막 행: ${summary.lastProcessedRowIndex || '—'})`);
  }
}
