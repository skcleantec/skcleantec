import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  INQUIRY_EXCEL_FIELD_CATALOG,
  INQUIRY_EXCEL_STATUS_LABELS,
  INQUIRY_EXCEL_VALUE_MAPPING_FIELD_KEYS,
} from '../../lib/inquiryExcelImportFields.js';
import type {
  InquiryExcelMappingSpec,
  InquiryExcelRowExecuteResult,
  InquiryExcelRowPreviewResult,
} from '../../lib/inquiryExcelImportPolicy.js';
import { createInquiryFromBody, InquiryCreateError } from '../inquiries/inquiryCreate.service.js';
import { findDuplicateInquiry } from './inquiryExcelImport.duplicate.js';
import { mapExcelRowToInquiryBody } from './inquiryExcelImport.map.js';
import { extractExcelHeaders, parseExcelBuffer, type ParsedExcelSheet } from './inquiryExcelImport.parse.js';

function parseMappingSpec(raw: unknown): InquiryExcelMappingSpec {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const columnMappings = Array.isArray(o.columnMappings)
    ? o.columnMappings
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const m = x as Record<string, unknown>;
          return {
            fieldKey: String(m.fieldKey ?? '').trim(),
            excelHeader: String(m.excelHeader ?? '').trim(),
          };
        })
        .filter((x) => x.fieldKey && x.excelHeader)
    : [];
  const valueMappings = Array.isArray(o.valueMappings)
    ? o.valueMappings
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const m = x as Record<string, unknown>;
          const fieldKey = String(m.fieldKey ?? '').trim();
          const entries = Array.isArray(m.entries)
            ? m.entries
                .filter((e) => e && typeof e === 'object')
                .map((e) => {
                  const en = e as Record<string, unknown>;
                  return {
                    excelValue: String(en.excelValue ?? '').trim(),
                    skValue: String(en.skValue ?? '').trim(),
                  };
                })
                .filter((e) => e.excelValue)
            : [];
          return { fieldKey, entries };
        })
        .filter((x) => x.fieldKey)
    : [];
  const emptyValueRules = Array.isArray(o.emptyValueRules)
    ? o.emptyValueRules
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const m = x as Record<string, unknown>;
          return {
            fieldKey: String(m.fieldKey ?? '').trim(),
            skValue: m.skValue == null || m.skValue === '' ? null : String(m.skValue),
          };
        })
        .filter((x) => x.fieldKey)
    : undefined;
  const unmappedPolicies =
    o.unmappedPolicies && typeof o.unmappedPolicies === 'object'
      ? (o.unmappedPolicies as InquiryExcelMappingSpec['unmappedPolicies'])
      : undefined;
  const defaultStatus =
    o.defaultStatus != null && String(o.defaultStatus).trim()
      ? String(o.defaultStatus).trim()
      : undefined;
  const memoLineMappings = Array.isArray(o.memoLineMappings)
    ? o.memoLineMappings
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const m = x as Record<string, unknown>;
          const targetRaw = String(m.targetFieldKey ?? 'specialNotes').trim();
          const targetFieldKey =
            targetRaw === 'memo' ? ('memo' as const) : ('specialNotes' as const);
          const excelHeaders = Array.isArray(m.excelHeaders)
            ? m.excelHeaders
                .map((h) => String(h ?? '').trim())
                .filter(Boolean)
            : [];
          return { targetFieldKey, excelHeaders };
        })
        .filter((x) => x.excelHeaders.length > 0)
    : undefined;
  return {
    columnMappings,
    valueMappings,
    emptyValueRules,
    unmappedPolicies,
    defaultStatus,
    memoLineMappings,
  };
}

export async function getInquiryExcelFieldCatalog(tenantId: string) {
  const operatingCompanies = await prisma.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, config: true },
  });
  return {
    fields: INQUIRY_EXCEL_FIELD_CATALOG,
    statusLabels: INQUIRY_EXCEL_STATUS_LABELS,
    valueMappingFieldKeys: INQUIRY_EXCEL_VALUE_MAPPING_FIELD_KEYS,
    operatingCompanies: operatingCompanies.map((oc) => {
      const cfg = oc.config as Record<string, unknown> | null;
      return {
        id: oc.id,
        name: oc.name,
        slug: oc.slug,
        displayName: typeof cfg?.displayName === 'string' ? cfg.displayName : null,
        numberPrefix: typeof cfg?.numberPrefix === 'string' ? cfg.numberPrefix : null,
      };
    }),
  };
}

export async function listInquiryExcelProfiles(tenantId: string) {
  return prisma.inquiryExcelImportProfile.findMany({
    where: { tenantId, isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      mappingSpec: true,
      updatedAt: true,
      createdAt: true,
    },
  });
}

export async function getInquiryExcelProfile(tenantId: string, profileId: string) {
  return prisma.inquiryExcelImportProfile.findFirst({
    where: { id: profileId, tenantId, isActive: true },
  });
}

export async function createInquiryExcelProfile(params: {
  tenantId: string;
  userId: string;
  name: string;
  mappingSpec: unknown;
}) {
  const name = params.name.trim();
  if (!name) throw new Error('서식 이름을 입력해주세요.');
  const mappingSpec = parseMappingSpec(params.mappingSpec);
  return prisma.inquiryExcelImportProfile.create({
    data: {
      tenantId: params.tenantId,
      name,
      mappingSpec: mappingSpec as unknown as Prisma.InputJsonValue,
      createdById: params.userId,
    },
  });
}

export async function updateInquiryExcelProfile(params: {
  tenantId: string;
  profileId: string;
  name?: string;
  mappingSpec?: unknown;
}) {
  const existing = await getInquiryExcelProfile(params.tenantId, params.profileId);
  if (!existing) return null;
  const data: Prisma.InquiryExcelImportProfileUpdateInput = {};
  if (params.name != null) {
    const name = params.name.trim();
    if (!name) throw new Error('서식 이름을 입력해주세요.');
    data.name = name;
  }
  if (params.mappingSpec !== undefined) {
    data.mappingSpec = parseMappingSpec(params.mappingSpec) as unknown as Prisma.InputJsonValue;
  }
  return prisma.inquiryExcelImportProfile.update({
    where: { id: existing.id },
    data,
  });
}

export async function deleteInquiryExcelProfile(tenantId: string, profileId: string) {
  const existing = await getInquiryExcelProfile(tenantId, profileId);
  if (!existing) return null;
  return prisma.inquiryExcelImportProfile.update({
    where: { id: existing.id },
    data: { isActive: false },
  });
}

async function processRows(params: {
  tenantId: string;
  spec: InquiryExcelMappingSpec;
  sheet: ParsedExcelSheet;
  mode: 'preview' | 'execute';
  userId?: string;
  userRole?: UserRole;
  profileId?: string;
  fileName?: string;
}): Promise<{
  preview?: InquiryExcelRowPreviewResult[];
  execute?: InquiryExcelRowExecuteResult[];
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  runId?: string;
}> {
  const preview: InquiryExcelRowPreviewResult[] = [];
  const execute: InquiryExcelRowExecuteResult[] = [];
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < params.sheet.rows.length; i++) {
    const rowIndex = i + 2;
    const excelRow = params.sheet.rows[i]!;
    const mapped = await mapExcelRowToInquiryBody({
      db: prisma,
      tenantId: params.tenantId,
      spec: params.spec,
      excelRow,
    });

    if (mapped.error) {
      errorCount++;
      if (params.mode === 'preview') {
        preview.push({ rowIndex, action: 'ERROR', message: mapped.error, mapped: mapped.body });
      } else {
        execute.push({ rowIndex, kind: 'ERROR', message: mapped.error });
      }
      continue;
    }

    if (mapped.skipReason) {
      skippedCount++;
      if (params.mode === 'preview') {
        preview.push({ rowIndex, action: 'SKIP', message: mapped.skipReason, mapped: mapped.body });
      } else {
        execute.push({ rowIndex, kind: 'SKIPPED', message: mapped.skipReason });
      }
      continue;
    }

    const dup = await findDuplicateInquiry({
      db: prisma,
      tenantId: params.tenantId,
      inquiryNumber: String(mapped.body.inquiryNumber ?? ''),
      customerName: String(mapped.body.customerName ?? ''),
      customerPhone: String(mapped.body.customerPhone ?? ''),
    });
    if (dup) {
      skippedCount++;
      const msg = `중복 — 접수번호·성함·연락처 일치 (#${dup.inquiryNumber ?? dup.id.slice(0, 8)})`;
      if (params.mode === 'preview') {
        preview.push({ rowIndex, action: 'SKIP', message: msg, mapped: mapped.body });
      } else {
        execute.push({ rowIndex, kind: 'SKIPPED', message: msg });
      }
      continue;
    }

    if (params.mode === 'preview') {
      preview.push({ rowIndex, action: 'CREATE', mapped: mapped.body });
      continue;
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
      createdCount++;
      execute.push({
        rowIndex,
        kind: 'CREATED',
        inquiryId: created.id,
        inquiryNumber: created.inquiryNumber,
      });
    } catch (e) {
      errorCount++;
      const msg =
        e instanceof InquiryCreateError
          ? e.message
          : e instanceof Error
            ? e.message
            : '접수 생성 실패';
      execute.push({ rowIndex, kind: 'ERROR', message: msg });
    }
  }

  let runId: string | undefined;
  if (params.mode === 'execute') {
    const run = await prisma.inquiryExcelImportRun.create({
      data: {
        tenantId: params.tenantId,
        profileId: params.profileId ?? null,
        fileName: params.fileName ?? null,
        totalRows: params.sheet.rows.length,
        createdCount,
        skippedCount,
        errorCount,
        rowResults: execute as unknown as Prisma.InputJsonValue,
        status: 'COMPLETED',
        actorId: params.userId ?? null,
      },
    });
    runId = run.id;
  }

  return {
    preview: params.mode === 'preview' ? preview : undefined,
    execute: params.mode === 'execute' ? execute : undefined,
    createdCount,
    skippedCount,
    errorCount,
    runId,
  };
}

export async function previewInquiryExcelImport(params: {
  tenantId: string;
  profileId: string;
  buffer: Buffer;
  fileName?: string;
}) {
  const profile = await getInquiryExcelProfile(params.tenantId, params.profileId);
  if (!profile) throw new Error('매칭 서식을 찾을 수 없습니다.');
  const spec = parseMappingSpec(profile.mappingSpec);
  const sheet = parseExcelBuffer(params.buffer, params.fileName);
  const result = await processRows({
    tenantId: params.tenantId,
    spec,
    sheet,
    mode: 'preview',
    fileName: params.fileName,
  });
  return {
    fileName: params.fileName,
    totalRows: sheet.rows.length,
    headers: sheet.headers,
    ...result,
  };
}

export async function executeInquiryExcelImport(params: {
  tenantId: string;
  userId: string;
  userRole: UserRole;
  profileId: string;
  buffer: Buffer;
  fileName?: string;
}) {
  const profile = await getInquiryExcelProfile(params.tenantId, params.profileId);
  if (!profile) throw new Error('매칭 서식을 찾을 수 없습니다.');
  const spec = parseMappingSpec(profile.mappingSpec);
  const sheet = parseExcelBuffer(params.buffer, params.fileName);
  const result = await processRows({
    tenantId: params.tenantId,
    spec,
    sheet,
    mode: 'execute',
    userId: params.userId,
    userRole: params.userRole,
    profileId: params.profileId,
    fileName: params.fileName,
  });
  return {
    fileName: params.fileName,
    totalRows: sheet.rows.length,
    runId: result.runId,
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
    errorCount: result.errorCount,
    rows: result.execute ?? [],
  };
}

export async function listInquiryExcelRuns(tenantId: string, limit = 20, offset = 0) {
  const [items, total] = await Promise.all([
    prisma.inquiryExcelImportRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        profile: { select: { id: true, name: true } },
        actor: { select: { id: true, name: true } },
      },
    }),
    prisma.inquiryExcelImportRun.count({ where: { tenantId } }),
  ]);
  return { items, total };
}

export { extractExcelHeaders, parseMappingSpec };
