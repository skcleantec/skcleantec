import { WebSocket } from 'ws';

/** `${tenantId}:${userId}` 또는 크루 `crew:${groupId}` → open WebSocket tabs */
const socketsByUser = new Map<string, Set<WebSocket>>();
/** tenantId → ADMIN·MARKETER tabs (테넌트별 staff broadcast) */
const staffBroadcastByTenant = new Map<string, Set<WebSocket>>();

function isStaffRole(role: string): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

/** 팀장·스태프 userId는 tenantId와 합성. 크루는 `crew:` 접두 유지 */
export function userSocketKey(userId: string, tenantId?: string): string {
  if (userId.startsWith('crew:')) return userId;
  if (tenantId) return `${tenantId}:${userId}`;
  return userId;
}

export function registerUserSocket(
  userId: string,
  role: string,
  ws: WebSocket,
  tenantId?: string,
): void {
  const key = userSocketKey(userId, tenantId);
  let set = socketsByUser.get(key);
  if (!set) {
    set = new Set();
    socketsByUser.set(key, set);
  }
  set.add(ws);
  if (isStaffRole(role) && tenantId) {
    let staffSet = staffBroadcastByTenant.get(tenantId);
    if (!staffSet) {
      staffSet = new Set();
      staffBroadcastByTenant.set(tenantId, staffSet);
    }
    staffSet.add(ws);
  }
  const onDone = () => {
    set?.delete(ws);
    if (tenantId) {
      const staffSet = staffBroadcastByTenant.get(tenantId);
      staffSet?.delete(ws);
      if (staffSet && staffSet.size === 0) staffBroadcastByTenant.delete(tenantId);
    }
    if (set && set.size === 0) socketsByUser.delete(key);
    ws.off('close', onDone);
    ws.off('error', onDone);
  };
  ws.on('close', onDone);
  ws.on('error', onDone);
}

/** 연결된 ADMIN·MARKETER 소켓에만 전송 (동일 테넌트) */
export function broadcastJsonToStaff(data: object, tenantId: string): void {
  const set = staffBroadcastByTenant.get(tenantId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(data);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}

export function sendJsonToUser(userId: string, data: object, tenantId?: string): boolean {
  const key = userSocketKey(userId, tenantId);
  const set = socketsByUser.get(key);
  if (!set || set.size === 0) return false;
  const payload = JSON.stringify(data);
  let delivered = false;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
        delivered = true;
      } catch {
        /* ignore */
      }
    }
  }
  return delivered;
}
