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

export type InquiryExcelMappingSpec = {
  columnMappings: InquiryExcelColumnMapping[];
  valueMappings: InquiryExcelValueMapping[];
  emptyValueRules?: InquiryExcelEmptyValueRule[];
  unmappedPolicies?: InquiryExcelUnmappedPolicies;
  /** status 미매핑·빈칸 시 USE_DEFAULT 정책용 */
  defaultStatus?: string;
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
