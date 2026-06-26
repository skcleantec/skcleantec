import { broadcastJsonToStaff } from './realtimeHub.js';

export type ScheduleDayMemoWsPayload = {
  type: 'schedule-day-memo:refresh';
  date: string;
};

/** 스케줄 당일 공유 메모 저장 후 같은 테넌트 ADMIN·MARKETER 탭에 알림 */
export function notifyScheduleDayStaffMemoRefresh(params: { tenantId: string; date: string }): void {
  const payload: ScheduleDayMemoWsPayload = {
    type: 'schedule-day-memo:refresh',
    date: params.date,
  };
  broadcastJsonToStaff(payload, params.tenantId);
}
