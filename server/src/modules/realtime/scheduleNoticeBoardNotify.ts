import { broadcastJsonToStaff } from './realtimeHub.js';

export type ScheduleNoticeBoardWsPayload = {
  type: 'schedule-notice-board:refresh';
};

/** 스케줄 공유 메모판 저장 후 같은 테넌트 ADMIN·MARKETER 탭에 알림 */
export function notifyScheduleStaffNoticeBoardRefresh(params: { tenantId: string }): void {
  const payload: ScheduleNoticeBoardWsPayload = {
    type: 'schedule-notice-board:refresh',
  };
  broadcastJsonToStaff(payload, params.tenantId);
}
