/**
 * @generated-sync from shared/inquiryExcelImportPolicy.ts — 직접 수정하지 마세요.
 */
/** 엑셀 일괄 접수 — 1회 최대 행 수 */
export const INQUIRY_EXCEL_IMPORT_MAX_ROWS = 500;

export type InquiryExcelUnmappedValuePolicy = 'ERROR' | 'USE_DEFAULT' | 'SKIP_ROW';

export type InquiryExcelColumnMapping = {
  fieldKey: string;
  excelHeader: string;
};

export type InquiryExcelValueMappingEntry = {
  excelValue: string;
  skValue: string;
};

export type InquiryExcelValueMapping = {
  fieldKey: string;
  entries: InquiryExcelValueMappingEntry[];
};

export type InquiryExcelEmptyValueRule = {
  fieldKey: string;
  skValue: string | null;
};

export type InquiryExcelUnmappedPolicies = Partial<
  Record<string, InquiryExcelUnmappedValuePolicy>
>;

export type InquiryExcelMemoLineMapping = {
  targetFieldKey?: 'specialNotes' | 'memo';
  excelHeaders: string[];
};

export type InquiryExcelMappingSpec = {
  columnMappings: InquiryExcelColumnMapping[];
  valueMappings: InquiryExcelValueMapping[];
  emptyValueRules?: InquiryExcelEmptyValueRule[];
  unmappedPolicies?: InquiryExcelUnmappedPolicies;
  defaultStatus?: string;
  defaultAreaBasis?: '공급' | '전용';
  memoLineMappings?: InquiryExcelMemoLineMapping[];
};

export type InquiryExcelRowPreviewResult = {
  rowIndex: number;
  action: 'CREATE' | 'SKIP' | 'ERROR';
  message?: string;
  mapped?: Record<string, unknown>;
};

export type InquiryExcelRowExecuteResult = {
  rowIndex: number;
  kind: 'CREATED' | 'SKIPPED' | 'ERROR';
  message?: string;
  inquiryId?: string;
  inquiryNumber?: string | null;
};
