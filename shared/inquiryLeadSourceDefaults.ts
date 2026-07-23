/** 테넌트 프로비저닝·마이그레이션 시드 — 표시명 = Inquiry.source / OrderFollowup.leadSource 저장값 */
export const DEFAULT_INQUIRY_LEAD_SOURCE_LABELS = [
  '숨고',
  '미소',
  '당근',
  '네이버',
  '크린토피아',
] as const;

export type DefaultInquiryLeadSourceLabel = (typeof DEFAULT_INQUIRY_LEAD_SOURCE_LABELS)[number];

/** 브릿지 extract → 카탈로그 label (테넌트가 이름을 바꾸면 수동 선택) */
export const BRIDGE_INQUIRY_LEAD_SOURCE_LABEL = {
  miso: '미소',
  soomgo: '숨고',
} as const;

export type BridgeInquiryLeadSourceId = keyof typeof BRIDGE_INQUIRY_LEAD_SOURCE_LABEL;
