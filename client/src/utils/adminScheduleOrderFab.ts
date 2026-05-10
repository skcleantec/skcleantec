/**
 * 스케줄 상세 모달(`ScheduleInquiryDetailModal`)이 열려 있을 때,
 * 모바일 발주서 FAB가 동일 접수에 `pendingInquiryId`를 넘기도록 inquiry id를 보관합니다.
 */
let scheduleDetailInquiryIdForOrderFab: string | null = null;

/** Prisma 기본 `uuid()` 및 일반적인 하이픈 UUID 형식 (버전·variant 비트 제한 없음) */
const INQUIRY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function setScheduleDetailInquiryIdForOrderFab(inquiryId: string | null | undefined): void {
  const t = typeof inquiryId === 'string' ? inquiryId.trim() : '';
  scheduleDetailInquiryIdForOrderFab = t && INQUIRY_ID_RE.test(t) ? t : null;
}

export function getScheduleDetailInquiryIdForOrderFab(): string | null {
  return scheduleDetailInquiryIdForOrderFab;
}
