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
  /** 줄바꿈으로 합칠 대상 — 기본 specialNotes(특이사항) */
  targetFieldKey?: 'specialNotes' | 'memo';
  /** 위에서 아래 순서대로 한 줄씩 합침 */
  excelHeaders: string[];
};

export type InquiryExcelMappingSpec = {
  columnMappings: InquiryExcelColumnMapping[];
  valueMappings: InquiryExcelValueMapping[];
  emptyValueRules?: InquiryExcelEmptyValueRule[];
  unmappedPolicies?: InquiryExcelUnmappedPolicies;
  /** status 미매핑·빈칸 시 USE_DEFAULT 정책용 */
  defaultStatus?: string;
  /** 평수(areaPyeong) 있는데 평수 기준 열이 없을 때 — 미설정 시 공급 */
  defaultAreaBasis?: '공급' | '전용';
  /** 특이사항1·2 등 — 순서대로 줄바꿈 결합 */
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
