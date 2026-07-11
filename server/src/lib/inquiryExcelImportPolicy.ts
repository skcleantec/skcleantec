/**
 * @generated-sync from shared/inquiryExcelImportPolicy.ts — 직접 수정하지 마세요.
 */
/** 엑셀 일괄 접수 — 1회 최대 행 수. 0이면 행 수 제한 없음(파일 크기·서버 타임아웃이 실질 한도). */
export const INQUIRY_EXCEL_IMPORT_MAX_ROWS = 0;

/** 업로드 파일 최대 크기(바이트) — multer·안내 문구와 동기화 */
export const INQUIRY_EXCEL_IMPORT_MAX_FILE_BYTES = 32 * 1024 * 1024;

/** 배치 일괄 등록 — 1회 HTTP 요청당 처리 행 수(타임아웃·진행률·이어하기용) */
export const INQUIRY_EXCEL_IMPORT_BATCH_SIZE = 40;

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
  kind: 'CREATED' | 'SKIPPED' | 'ERROR' | 'DELETED';
  message?: string;
  inquiryId?: string;
  inquiryNumber?: string | null;
};
