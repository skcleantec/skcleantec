/** 연결 통화 최소 duration(초) — 미수신 벨 울림(~60초) 제외 */
export const TELECRM_CONNECTED_MIN_SEC = 90;

export type TelecrmCallSessionStatus = 'DIAL_ATTEMPT' | 'NO_ANSWER' | 'CONNECTED';

export type TelecrmCallSessionSource = 'APP_DIAL' | 'PC_DISPATCH' | 'CALLLOG_SYNC';

export function classifyCallSessionStatus(
  durationSec: number | null | undefined,
  connectedMinSec = TELECRM_CONNECTED_MIN_SEC,
): TelecrmCallSessionStatus {
  const sec = typeof durationSec === 'number' && Number.isFinite(durationSec) ? Math.max(0, Math.floor(durationSec)) : 0;
  if (sec >= connectedMinSec) return 'CONNECTED';
  if (sec > 0) return 'NO_ANSWER';
  return 'NO_ANSWER';
}
