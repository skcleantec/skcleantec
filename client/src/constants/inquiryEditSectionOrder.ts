/**
 * 접수 수정 모달 섹션 **고정 번호** (오른쪽 FAB·카드 제목 `1. …` 공통)
 * — DOM/조건부 렌더와 무관하게 동일한 의미의 번호를 유지합니다.
 */
/** 번호 7: 상담·참고(사진·메모) / 8~: 발주서·현장·이력 (클레임은 번호 없이 표시) */
export const INQUIRY_EDIT_SECTION_ANCHOR_ORDER = [
  'customer',
  'property',
  'schedule',
  'settlement',
  'extra-charges',
  'status',
  'consultation-photos',
  'order-photos',
  'site-photos',
  'history',
] as const;

export type InquiryEditSectionAnchor = (typeof INQUIRY_EDIT_SECTION_ANCHOR_ORDER)[number];

/** 툴팁·aria용 짧은 이름 (ORDER와 동일 길이) */
export const INQUIRY_EDIT_SECTION_TITLE_HINTS = [
  '고객 · 주소',
  '유형 · 면적 · 방·주방',
  '일정',
  '정산 · 옵션',
  '결제 금액 내역 (추가결재)',
  '상태 · 배정 · 팀원 · 메모',
  '상담·참고 (사진·마케터 메모)',
  '발주서 첨부 사진 (고객 업로드)',
  '현장 사진 (청소 전·후)',
  '날짜·금액 변경 이력',
] as const;

export function getInquiryEditSectionNumber(anchor: string | undefined): number | null {
  if (!anchor) return null;
  const i = (INQUIRY_EDIT_SECTION_ANCHOR_ORDER as readonly string[]).indexOf(anchor);
  return i >= 0 ? i + 1 : null;
}

export function inquiryEditSecDomId(anchor: string): string {
  return `inq-edit-sec-${anchor}`;
}
