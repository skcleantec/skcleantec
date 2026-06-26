/** 엑셀 일괄 접수 — SK 필드 카탈로그 (클라·서버 공통) */

export type InquiryExcelFieldKind = 'text' | 'number' | 'date' | 'enum' | 'lookup';

export type InquiryExcelFieldDef = {
  key: string;
  label: string;
  kind: InquiryExcelFieldKind;
  required?: boolean;
  /** enum·lookup 필드 — 값 매핑 UI 대상 */
  valueMapping?: boolean;
  hint?: string;
};

/** 접수 생성 API와 동일하게 허용하는 상태 */
export const INQUIRY_EXCEL_CREATE_STATUSES = [
  'PENDING',
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'CS_PROCESSING',
] as const;

export type InquiryExcelCreateStatus = (typeof INQUIRY_EXCEL_CREATE_STATUSES)[number];

export const INQUIRY_EXCEL_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '예약완료',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

export const INQUIRY_EXCEL_VALUE_MAPPING_FIELD_KEYS = [
  'status',
  'operatingCompanyId',
  'preferredTime',
  'buildingType',
  'source',
  'propertyType',
] as const;

/** SK 접수 편집과 동일 — 평수 기준 */
export const INQUIRY_EXCEL_AREA_BASIS_VALUES = ['공급', '전용'] as const;
export type InquiryExcelAreaBasis = (typeof INQUIRY_EXCEL_AREA_BASIS_VALUES)[number];
export const INQUIRY_EXCEL_DEFAULT_AREA_BASIS: InquiryExcelAreaBasis = '공급';

export const INQUIRY_EXCEL_FIELD_CATALOG: InquiryExcelFieldDef[] = [
  { key: 'inquiryNumber', label: '접수번호', kind: 'text', hint: '외부 번호 — 비어 있으면 입금대기만 자동 발번' },
  { key: 'customerName', label: '성함', kind: 'text', required: true },
  { key: 'nickname', label: '호칭·별칭', kind: 'text' },
  { key: 'customerPhone', label: '연락처', kind: 'text', required: true },
  { key: 'customerPhone2', label: '연락처2', kind: 'text' },
  { key: 'address', label: '주소', kind: 'text', required: true },
  { key: 'addressDetail', label: '상세주소', kind: 'text' },
  { key: 'status', label: '상태', kind: 'enum', valueMapping: true },
  { key: 'operatingCompanyId', label: '운영사', kind: 'lookup', valueMapping: true },
  { key: 'createdAt', label: '접수일', kind: 'date', hint: '목록·집계의 접수일(createdAt) — KST 날짜' },
  { key: 'preferredDate', label: '예약일', kind: 'date' },
  { key: 'preferredTime', label: '시간대', kind: 'enum', valueMapping: true },
  { key: 'preferredTimeDetail', label: '사이청소 시각', kind: 'text' },
  { key: 'areaPyeong', label: '평수', kind: 'number' },
  { key: 'areaBasis', label: '평수 기준', kind: 'text', hint: '공급 · 전용 — 열 없으면 서식 기본값(기본 공급)' },
  { key: 'exclusiveAreaSqm', label: '전용면적(㎡)', kind: 'number' },
  { key: 'propertyType', label: '주거형태', kind: 'enum', valueMapping: true },
  { key: 'buildingType', label: '신축/구축', kind: 'enum', valueMapping: true },
  { key: 'roomCount', label: '방', kind: 'number' },
  { key: 'bathroomCount', label: '욕실', kind: 'number' },
  { key: 'balconyCount', label: '발코니', kind: 'number' },
  { key: 'serviceTotalAmount', label: '총액', kind: 'number', hint: '원 — 고객 결제 총액(가격 등)' },
  { key: 'serviceDepositAmount', label: '예약금', kind: 'number', hint: '원 — 없으면 잔금=총액' },
  { key: 'serviceBalanceAmount', label: '잔금', kind: 'number', hint: '원 — 비우면 자동 계산' },
  { key: 'specialNotes', label: '특이사항', kind: 'text', hint: '단일 열 또는 아래 「줄 합치기」' },
  { key: 'memo', label: '메모', kind: 'text' },
  { key: 'source', label: '유입경로', kind: 'enum', valueMapping: true },
  { key: 'callAttempt', label: '통화시도', kind: 'number' },
];

export function inquiryExcelFieldByKey(key: string): InquiryExcelFieldDef | undefined {
  return INQUIRY_EXCEL_FIELD_CATALOG.find((f) => f.key === key);
}
