import type { InquiryExcelMappingSpec } from '../../lib/inquiryExcelImportPolicy.js';

export function parseMappingSpec(raw: unknown): InquiryExcelMappingSpec {
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
  const defaultAreaBasisRaw =
    o.defaultAreaBasis != null ? String(o.defaultAreaBasis).trim() : '';
  const defaultAreaBasis =
    defaultAreaBasisRaw === '전용' ? ('전용' as const) : defaultAreaBasisRaw === '공급' ? ('공급' as const) : undefined;
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
    defaultAreaBasis,
    memoLineMappings,
  };
}
