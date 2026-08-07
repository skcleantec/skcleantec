import type { ScheduleHelpCalloutDef } from '../schedule-help/ScheduleHelpAnnotatedPanel';

export const INQUIRY_HELP_SCREENSHOTS = {
  listOverview: '/help/screenshots/admin_접수_관리_접수_목록.png',
} as const;

/** admin_접수_관리_접수_목록.png — 실제 캡처 보조용 */
export const INQUIRY_HELP_LIST_CALLOUTS: ScheduleHelpCalloutDef[] = [
  { id: 1, label: '마케터별 확정 예약 집계', anchorX: 38, anchorY: 10 },
  { id: 2, label: '날짜 기준 · 기간 필터', anchorX: 32, anchorY: 22 },
  { id: 3, label: '검색 · 상태 · 접수자 필터', anchorX: 55, anchorY: 32 },
  { id: 4, label: '목록 상단 고정 범례', anchorX: 28, anchorY: 40 },
  { id: 5, label: '행 클릭 → 접수 상세', anchorX: 42, anchorY: 58 },
  { id: 6, label: '상태 · 작업 열', anchorX: 88, anchorY: 58 },
];

/** InquiryHelpListFullPreview — 데모 목록 주석 */
export const INQUIRY_HELP_LIST_FULL_CALLOUTS: ScheduleHelpCalloutDef[] = [
  { id: 1, label: '접수일 · 접수번호(CB…)', anchorX: 6, anchorY: 38 },
  { id: 2, label: '브랜드 · 파트너 · 정보공유', anchorX: 6, anchorY: 48 },
  { id: 3, label: '날짜·기간 필터', anchorX: 18, anchorY: 12 },
  { id: 4, label: '내부톤 · 클레임 ●', anchorX: 38, anchorY: 32 },
  { id: 5, label: '상태 ▾ · 미제출 안내', anchorX: 68, anchorY: 32 },
  { id: 6, label: '특이 · 사진 O/X', anchorX: 76, anchorY: 32 },
  { id: 7, label: '현장검수 · 팀장', anchorX: 84, anchorY: 32 },
  { id: 8, label: '작업(고객 발송·수정 등)', anchorX: 94, anchorY: 32 },
  { id: 9, label: '모바일 — 접수번호 칩 · 전화', anchorX: 72, anchorY: 82 },
  { id: 10, label: 'pin tier 행 배경색', anchorX: 50, anchorY: 28 },
];
