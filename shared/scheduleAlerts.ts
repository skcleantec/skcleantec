/** 일정 긴급 알림(사이렌) — DB `schedule_alert_kind` 와 동기 */
export type ScheduleAlertKind = 'date' | 'cancel' | 'cost';

export const SCHEDULE_ALERT_KIND_LABELS: Record<ScheduleAlertKind, string> = {
  date: '일정변경',
  cancel: '취소',
  cost: '금액변경',
};
