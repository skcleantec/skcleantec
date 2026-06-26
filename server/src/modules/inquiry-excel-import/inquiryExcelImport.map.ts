import type { PrismaClient } from '@prisma/client';
import {
  INQUIRY_EXCEL_CREATE_STATUSES,
  inquiryExcelFieldByKey,
} from '../../lib/inquiryExcelImportFields.js';
import type {
  InquiryExcelMappingSpec,
  InquiryExcelUnmappedValuePolicy,
} from '../../lib/inquiryExcelImportPolicy.js';
import { normalizeInquiryServiceAmounts } from '../inquiries/inquiryServiceAmounts.js';
import {
  normalizeExcelHeader,
  normalizePhoneFromExcel,
  phoneColumnMappingHint,
} from './inquiryExcelImport.cellValue.js';

export type MappedInquiryRow = {
  body: Record<string, unknown>;
  skipReason?: string;
  error?: string;
};

function normExcelVal(v: string): string {
  return v.trim();
}

function lookupValueMapping(
  spec: InquiryExcelMappingSpec,
  fieldKey: string,
  raw: string,
): string | null | undefined {
  const vm = spec.valueMappings.find((x) => x.fieldKey === fieldKey);
  if (!vm) return undefined;
  const hit = vm.entries.find((e) => normExcelVal(e.excelValue) === normExcelVal(raw));
  return hit ? hit.skValue : undefined;
}

function emptyRuleValue(spec: InquiryExcelMappingSpec, fieldKey: string): string | null | undefined {
  const rule = spec.emptyValueRules?.find((x) => x.fieldKey === fieldKey);
  return rule?.skValue;
}

function unmappedPolicy(
  spec: InquiryExcelMappingSpec,
  fieldKey: string,
): InquiryExcelUnmappedValuePolicy {
  return spec.unmappedPolicies?.[fieldKey] ?? (fieldKey === 'status' ? 'ERROR' : 'USE_DEFAULT');
}

async function resolveOperatingCompanyFromExcelText(
  db: PrismaClient,
  tenantId: string,
  text: string,
): Promise<string | null> {
  const q = text.trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  const companies = await db.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, slug: true, config: true },
  });
  for (const oc of companies) {
    if (oc.name.trim() === q) return oc.id;
    if (oc.slug.toLowerCase() === lower) return oc.id;
    const cfg = oc.config as Record<string, unknown> | null;
    const displayName = typeof cfg?.displayName === 'string' ? cfg.displayName.trim() : '';
    if (displayName && displayName === q) return oc.id;
    const prefix = typeof cfg?.numberPrefix === 'string' ? cfg.numberPrefix.trim() : '';
    if (prefix && prefix === q) return oc.id;
  }
  return null;
}

function parseDateValue(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = String(Number(m[2])).padStart(2, '0');
    const d = String(Number(m[3])).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 60000) {
    const parsed = XlsxSerialToYmd(n);
    if (parsed) return parsed;
  }
  return null;
}

function XlsxSerialToYmd(serial: number): string | null {
  const utc = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (Number.isNaN(utc.getTime())) return null;
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function memoLineHeaderSet(spec: InquiryExcelMappingSpec): Set<string> {
  const out = new Set<string>();
  for (const group of spec.memoLineMappings ?? []) {
    for (const h of group.excelHeaders ?? []) {
      const t = h.trim();
      if (t) out.add(t);
    }
  }
  return out;
}

function applyMemoLineMappings(
  spec: InquiryExcelMappingSpec,
  excelRow: Record<string, string>,
  body: Record<string, unknown>,
): void {
  for (const group of spec.memoLineMappings ?? []) {
    const target = group.targetFieldKey ?? 'specialNotes';
    const lines: string[] = [];
    for (const header of group.excelHeaders ?? []) {
      const v = normExcelVal(excelRow[header] ?? '');
      if (v) lines.push(v);
    }
    if (lines.length === 0) continue;
    const combined = lines.join('\n');
    const existing = body[target];
    body[target] =
      existing != null && String(existing).trim()
        ? `${String(existing).trim()}\n${combined}`
        : combined;
  }
}

export async function mapExcelRowToInquiryBody(params: {
  db: PrismaClient;
  tenantId: string;
  spec: InquiryExcelMappingSpec;
  excelRow: Record<string, string>;
}): Promise<MappedInquiryRow> {
  const { db, tenantId, spec, excelRow } = params;
  const body: Record<string, unknown> = {};
  const memoHeaders = memoLineHeaderSet(spec);
  const headerToField = new Map<string, string>();
  for (const cm of spec.columnMappings) {
    if (cm.excelHeader && cm.fieldKey) {
      headerToField.set(normalizeExcelHeader(cm.excelHeader), cm.fieldKey);
    }
  }

  for (const [header, rawVal] of Object.entries(excelRow)) {
    if (memoHeaders.has(header)) continue;
    const fieldKey = headerToField.get(normalizeExcelHeader(header));
    if (!fieldKey) continue;
    const def = inquiryExcelFieldByKey(fieldKey);
    const trimmed = normExcelVal(rawVal);

    if (!trimmed) {
      const emptyVal = emptyRuleValue(spec, fieldKey);
      if (emptyVal !== undefined) {
        if (emptyVal != null && emptyVal !== '') body[fieldKey] = emptyVal;
        continue;
      }
      continue;
    }

    if (def?.valueMapping || fieldKey === 'operatingCompanyId') {
      const mapped = lookupValueMapping(spec, fieldKey, trimmed);
      if (mapped !== undefined) {
        if (fieldKey === 'operatingCompanyId') {
          body.operatingCompanyId = mapped;
        } else {
          body[fieldKey] = mapped;
        }
        continue;
      }
      if (fieldKey === 'operatingCompanyId') {
        const resolved = await resolveOperatingCompanyFromExcelText(db, tenantId, trimmed);
        if (resolved) {
          body.operatingCompanyId = resolved;
          continue;
        }
        const policy = unmappedPolicy(spec, fieldKey);
        if (policy === 'SKIP_ROW') return { body, skipReason: `운영사 '${trimmed}' 를 찾을 수 없습니다.` };
        if (policy === 'ERROR') return { body, error: `운영사 '${trimmed}' 를 찾을 수 없습니다.` };
        continue;
      }
      const policy = unmappedPolicy(spec, fieldKey);
      if (policy === 'SKIP_ROW') return { body, skipReason: `${def?.label ?? fieldKey} 값 '${trimmed}' 매핑 없음` };
      if (policy === 'ERROR') return { body, error: `${def?.label ?? fieldKey} 값 '${trimmed}' 매핑 없음` };
      if (policy === 'USE_DEFAULT' && fieldKey === 'status' && spec.defaultStatus) {
        body.status = spec.defaultStatus;
      }
      continue;
    }

    if (def?.kind === 'date') {
      const ymd = parseDateValue(trimmed);
      if (!ymd) return { body, error: `${def.label} 날짜 형식 오류: '${trimmed}'` };
      body[fieldKey] = ymd;
      continue;
    }

    if (def?.kind === 'number') {
      const n = Number(trimmed.replace(/,/g, ''));
      if (!Number.isFinite(n)) return { body, error: `${def.label} 숫자 형식 오류: '${trimmed}'` };
      body[fieldKey] = n;
      continue;
    }

    if (fieldKey === 'customerPhone' || fieldKey === 'customerPhone2') {
      body[fieldKey] = normalizePhoneFromExcel(trimmed);
      continue;
    }

    body[fieldKey] = trimmed;
  }

  applyMemoLineMappings(spec, excelRow, body);

  if (!body.status) {
    const policy = unmappedPolicy(spec, 'status');
    if (spec.defaultStatus && policy === 'USE_DEFAULT') {
      body.status = spec.defaultStatus;
    } else if (!body.status) {
      body.status = 'RECEIVED';
    }
  }

  const status = String(body.status ?? '');
  if (status && !INQUIRY_EXCEL_CREATE_STATUSES.includes(status as (typeof INQUIRY_EXCEL_CREATE_STATUSES)[number])) {
    return { body, error: `허용되지 않는 상태: ${status}` };
  }

  if (!String(body.customerName ?? '').trim()) {
    return { body, error: '성함이 비어 있습니다.' };
  }
  if (!String(body.customerPhone ?? '').trim()) {
    const phoneMapping = spec.columnMappings.find((m) => m.fieldKey === 'customerPhone');
    const mappedHeader = phoneMapping?.excelHeader;
    const hint = phoneColumnMappingHint(excelRow, mappedHeader);
    const mappedLabel = mappedHeader ? ` (매핑 열: '${mappedHeader}')` : '';
    return { body, error: `연락처가 비어 있습니다.${mappedLabel}${hint}` };
  }

  const areaBasisTrim = String(body.areaBasis ?? '').trim();
  const hasPyeong =
    body.areaPyeong != null &&
    body.areaPyeong !== '' &&
    Number.isFinite(Number(body.areaPyeong));
  if (!areaBasisTrim && hasPyeong) {
    const fallback = spec.defaultAreaBasis ?? '공급';
    body.areaBasis = fallback === '전용' ? '전용' : '공급';
  }

  const amountError = normalizeInquiryServiceAmounts(body);
  if (amountError) {
    return { body, error: amountError };
  }

  return { body };
}
