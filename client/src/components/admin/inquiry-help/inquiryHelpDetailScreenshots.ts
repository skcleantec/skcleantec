/** 접수 상세 도움말 — 섹션별 화면 미리보기 id */

export type InquiryHelpDetailPreviewId =
  | 'assignment-overview'
  | 'header'
  | 'copy-sheet'
  | 'partner'
  | 'marketplace'
  | 'fab'
  | 'customer'
  | 'property'
  | 'schedule'
  | 'settlement'
  | 'extra-charges'
  | 'status'
  | 'consultation'
  | 'order-photos'
  | 'inspection'
  | 'site-photos'
  | 'history'
  | 'extra-blocks'
  | 'custom-calendar'
  | 'create-intake'
  | 'footer';

export const INQUIRY_HELP_DETAIL_SECTION_PREVIEW: Record<number, InquiryHelpDetailPreviewId> = {
  1: 'customer',
  2: 'property',
  3: 'schedule',
  4: 'settlement',
  5: 'extra-charges',
  6: 'status',
  7: 'consultation',
  8: 'order-photos',
  9: 'inspection',
  10: 'site-photos',
  11: 'history',
};

export const INQUIRY_HELP_DETAIL_PREVIEW_CAPTION =
  '데모 데이터(○○·마스킹) 화면 예시입니다. 「크게 보기」로 확대할 수 있습니다.';
