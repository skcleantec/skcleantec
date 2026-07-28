import {
  INQUIRY_EXCEL_FIELD_CATALOG,
  type InquiryExcelFieldDef,
} from '@shared/inquiryExcelImportFields';
import type { InquiryExcelMappingSpec } from '@shared/inquiryExcelImportPolicy';

export const INQUIRY_EXCEL_REQUIRED_FIELD_KEYS = ['customerName', 'customerPhone', 'address'] as const;

export type ExcelColumnFilter = 'all' | 'unmapped' | 'mapped' | 'required';

export type ExcelFieldGroup = {
  id: string;
  label: string;
  fieldKeys: string[];
};

const SCHEDULE_AMOUNT_KEYS = new Set([
  'createdAt',
  'preferredDate',
  'preferredTime',
  'preferredTimeDetail',
  'areaPyeong',
  'areaBasis',
  'exclusiveAreaSqm',
  'serviceTotalAmount',
  'serviceDepositAmount',
  'serviceBalanceAmount',
]);

const PROPERTY_KEYS = new Set([
  'propertyType',
  'buildingType',
  'roomCount',
  'bathroomCount',
  'balconyCount',
]);

export function buildInquiryExcelFieldGroups(): ExcelFieldGroup[] {
  const required = INQUIRY_EXCEL_REQUIRED_FIELD_KEYS as readonly string[];
  const scheduleAmount: string[] = [];
  const property: string[] = [];
  const other: string[] = [];
  for (const f of INQUIRY_EXCEL_FIELD_CATALOG) {
    if (required.includes(f.key)) continue;
    if (SCHEDULE_AMOUNT_KEYS.has(f.key)) scheduleAmount.push(f.key);
    else if (PROPERTY_KEYS.has(f.key)) property.push(f.key);
    else other.push(f.key);
  }
  return [
    { id: 'required', label: '필수', fieldKeys: [...required] },
    { id: 'schedule', label: '일정·금액', fieldKeys: scheduleAmount },
    { id: 'property', label: '주거·시공', fieldKeys: property },
    { id: 'other', label: '기타', fieldKeys: other },
  ];
}

export function mergeExcelHeaderLists(...lists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    for (const h of list) {
      if (h) set.add(h);
    }
  }
  return [...set];
}

export function collectExcelHeadersFromSpec(spec: InquiryExcelMappingSpec): string[] {
  const set = new Set<string>();
  for (const m of spec.columnMappings) {
    if (m.excelHeader) set.add(m.excelHeader);
  }
  for (const g of spec.memoLineMappings ?? []) {
    for (const h of g.excelHeaders ?? []) {
      if (h) set.add(h);
    }
  }
  for (const h of spec.knownHeaders ?? []) {
    if (h) set.add(h);
  }
  return [...set];
}

export function getFieldKeyForHeader(spec: InquiryExcelMappingSpec, excelHeader: string): string {
  return spec.columnMappings.find((m) => m.excelHeader === excelHeader)?.fieldKey ?? '';
}

export function getHeaderForFieldKey(spec: InquiryExcelMappingSpec, fieldKey: string): string {
  return spec.columnMappings.find((m) => m.fieldKey === fieldKey)?.excelHeader ?? '';
}

export function setHeaderFieldMapping(
  spec: InquiryExcelMappingSpec,
  excelHeader: string,
  fieldKey: string,
): InquiryExcelMappingSpec {
  let columnMappings = spec.columnMappings.filter((m) => m.excelHeader !== excelHeader);
  if (fieldKey) {
    columnMappings = columnMappings.filter((m) => m.fieldKey !== fieldKey);
    columnMappings = [...columnMappings, { fieldKey, excelHeader }];
  }
  return { ...spec, columnMappings };
}

export function setFieldHeaderMapping(
  spec: InquiryExcelMappingSpec,
  fieldKey: string,
  excelHeader: string,
): InquiryExcelMappingSpec {
  if (!excelHeader) {
    return {
      ...spec,
      columnMappings: spec.columnMappings.filter((m) => m.fieldKey !== fieldKey),
    };
  }
  let columnMappings = spec.columnMappings.filter((m) => m.fieldKey !== fieldKey);
  columnMappings = columnMappings.filter((m) => m.excelHeader !== excelHeader);
  columnMappings = [...columnMappings, { fieldKey, excelHeader }];
  return { ...spec, columnMappings };
}

export type MappingProgressSummary = {
  requiredMapped: number;
  requiredTotal: number;
  mappedColumnCount: number;
  unmappedHeaderCount: number;
  totalHeaderCount: number;
  missingRequiredLabels: string[];
};

export function computeMappingProgress(
  spec: InquiryExcelMappingSpec,
  excelHeaders: string[],
  memoLineHeaders: string[],
  fieldByKey: (key: string) => InquiryExcelFieldDef | undefined,
): MappingProgressSummary {
  const memoSet = new Set(memoLineHeaders.filter(Boolean));
  const requiredTotal = INQUIRY_EXCEL_REQUIRED_FIELD_KEYS.length;
  let requiredMapped = 0;
  const missingRequiredLabels: string[] = [];
  for (const key of INQUIRY_EXCEL_REQUIRED_FIELD_KEYS) {
    const header = getHeaderForFieldKey(spec, key);
    if (header) requiredMapped += 1;
    else missingRequiredLabels.push(fieldByKey(key)?.label ?? key);
  }
  const mappedHeaders = new Set(
    spec.columnMappings.filter((m) => m.excelHeader).map((m) => m.excelHeader),
  );
  let unmappedHeaderCount = 0;
  for (const h of excelHeaders) {
    if (memoSet.has(h)) continue;
    if (!mappedHeaders.has(h)) unmappedHeaderCount += 1;
  }
  return {
    requiredMapped,
    requiredTotal,
    mappedColumnCount: mappedHeaders.size,
    unmappedHeaderCount,
    totalHeaderCount: excelHeaders.length,
    missingRequiredLabels,
  };
}

export function filterExcelHeadersForView(
  excelHeaders: string[],
  spec: InquiryExcelMappingSpec,
  memoLineHeaders: string[],
  filter: ExcelColumnFilter,
): string[] {
  const memoSet = new Set(memoLineHeaders.filter(Boolean));
  return excelHeaders.filter((header) => {
    if (memoSet.has(header)) return filter === 'all';
    const fieldKey = getFieldKeyForHeader(spec, header);
    const mapped = Boolean(fieldKey);
    const isRequiredField = fieldKey
      ? (INQUIRY_EXCEL_REQUIRED_FIELD_KEYS as readonly string[]).includes(fieldKey)
      : false;
    if (filter === 'all') return true;
    if (filter === 'unmapped') return !mapped;
    if (filter === 'mapped') return mapped;
    if (filter === 'required') return isRequiredField;
    return true;
  });
}

export function fieldLabelByKey(key: string): string {
  return INQUIRY_EXCEL_FIELD_CATALOG.find((f) => f.key === key)?.label ?? key;
}

export function fieldHintByKey(key: string): string | undefined {
  return INQUIRY_EXCEL_FIELD_CATALOG.find((f) => f.key === key)?.hint;
}
