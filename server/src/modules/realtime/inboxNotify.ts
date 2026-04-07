import { sendJsonToUser } from './realtimeHub.js';

/** 메시지함 갱신 — 클라이언트가 GET으로 다시 불러오도록 신호만 보냄 */
export function notifyInboxRefresh(userIds: string[]): void {
  const seen = new Set<string>();
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    sendJsonToUser(id, { type: 'inbox:refresh' });
  }
}
