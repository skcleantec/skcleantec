/**
 * 스케줄 상세 모달(`ScheduleInquiryDetailModal`)이 열려 있을 때,
 * 모바일 발주서 FAB가 동일 접수에 `pendingInquiryId`를 넘기도록 inquiry id를 보관합니다.
 */
let scheduleDetailInquiryIdForOrderFab: string | null = null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function setScheduleDetailInquiryIdForOrderFab(inquiryId: string | null | undefined): void {
  const t = typeof inquiryId === 'string' ? inquiryId.trim() : '';
  scheduleDetailInquiryIdForOrderFab = t && UUID_RE.test(t) ? t : null;
}

export function getScheduleDetailInquiryIdForOrderFab(): string | null {
  return scheduleDetailInquiryIdForOrderFab;
}
