/** `/help/screenshots` — 스케줄 도움말 모달·`/help` markdown 공통 경로 */

import type { ScheduleHelpCalloutDef } from './ScheduleHelpAnnotatedPanel';

export const SCHEDULE_HELP_SCREENSHOTS = {
  /** PC 스케줄 전체(달력·범례) */
  calendarOverview: '/help/screenshots/admin_스케줄_관리_스케줄_표.png',
} as const;

/** admin_스케줄_관리_스케줄_표.png — 앵커는 이미지 영역 % */
export const SCHEDULE_HELP_CALENDAR_CALLOUTS: ScheduleHelpCalloutDef[] = [
  { id: 1, label: '범례 — 마감·미배정·선택한 날', anchorX: 38, anchorY: 16 },
  { id: 2, label: 'PC 왼쪽 — 접수 검색·맞춤 캘린더(좁은 화면 ≡ 메뉴)', anchorX: 6, anchorY: 28 },
  { id: 3, label: 'AM · PM 남은 자리', anchorX: 14, anchorY: 50 },
  { id: 4, label: '👥 팀원 가용', anchorX: 14, anchorY: 55 },
  { id: 5, label: '⚠️ 미배정 · ⚡ 사이', anchorX: 16, anchorY: 60 },
  { id: 6, label: '하단 점 — 대기·보류·취소', anchorX: 14, anchorY: 65 },
];

/** 맞춤 캘린더 미리보기 — 앵커는 미리보기 그리드 % */
export const SCHEDULE_HELP_CUSTOM_UI_CALLOUTS: ScheduleHelpCalloutDef[] = [
  { id: 1, label: '접수 검색 — 고객명·전화·접수번호·주소', anchorX: 22, anchorY: 14 },
  { id: 2, label: '캘린더 추가 — 지역·업체·파트너', anchorX: 22, anchorY: 38 },
  { id: 3, label: '지역별 · 업체별 목록', anchorX: 22, anchorY: 58 },
  { id: 4, label: '달력 색 탭 — 전체 / 맞춤 전환', anchorX: 72, anchorY: 10 },
];

export type { ScheduleHelpCalloutDef };
