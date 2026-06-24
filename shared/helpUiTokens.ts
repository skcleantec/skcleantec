/** 도움말 {{ui:…}} 토큰 ID — helpUiRegistry 와 markdown 이 동일 목록을 씁니다. */
export const HELP_UI_TOKENS = [
  // 스케줄 — 상단 버튼
  'schedule-btn-close',
  'schedule-btn-close-release',
  'schedule-btn-staff-adjust',
  'schedule-btn-leader-adjust',
  'schedule-btn-map',
  // 스케줄 — 카드
  'schedule-badge-am',
  'schedule-badge-pm',
  'schedule-badge-side',
  'schedule-badge-unassigned',
  'schedule-marketplace-cart',
  // 정보공유 — 탭·상태
  'db-tabs',
  'db-status-cart',
  'db-status-open',
  'db-status-pending',
  'db-status-confirmed',
  // 정보공유 — 버튼
  'db-btn-cart-add',
  'db-btn-publish',
  'db-btn-revert',
  'db-btn-buy',
  'db-btn-confirm',
  'db-btn-decline',
  'db-btn-revert-to-cart',
  // 대시보드
  'dash-stat-today',
  'dash-stat-unassigned',
  'dash-stat-happy-overdue',
  'dash-stat-happy-pending',
  'dash-badge-realtime',
  'dash-btn-ad-settle',
  // 서비스접수
  'inq-date-preset',
  'inq-btn-manual',
  'inq-btn-marketer-daily',
  'inq-status-received',
  'inq-status-pending',
  'inq-status-unsubmitted',
  'inq-btn-call',
  'inq-hint-order-pending',
  'inq-hint-pin-pending',
  // 관리자 전용
  'tl-tabs-user-register',
  'tl-tabs-payroll',
  'tl-badge-marketer-limited',
  'tl-badge-marketer-full',
  'tl-btn-dayoff-allow',
  'tl-btn-dayoff-deny',
] as const;

export type HelpUiTokenId = (typeof HELP_UI_TOKENS)[number];

export function isHelpUiTokenId(value: string): value is HelpUiTokenId {
  return (HELP_UI_TOKENS as readonly string[]).includes(value);
}
