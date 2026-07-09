import { WebSocket } from 'ws';

export type RealtimeClientPlatform = 'web' | 'telecrm-app';

type RegisteredSocket = {
  ws: WebSocket;
  platform: RealtimeClientPlatform;
};

/** `${tenantId}:${userId}` 또는 크루 `crew:${groupId}` → open WebSocket tabs */
const socketsByUser = new Map<string, Set<RegisteredSocket>>();
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

function addSocketToUser(key: string, entry: RegisteredSocket): void {
  let set = socketsByUser.get(key);
  if (!set) {
    set = new Set();
    socketsByUser.set(key, set);
  }
  set.add(entry);
}

export function registerUserSocket(
  userId: string,
  role: string,
  ws: WebSocket,
  tenantId?: string,
  platform: RealtimeClientPlatform = 'web',
): void {
  const key = userSocketKey(userId, tenantId);
  const entry: RegisteredSocket = { ws, platform };
  addSocketToUser(key, entry);
  if (isStaffRole(role) && tenantId) {
    let staffSet = staffBroadcastByTenant.get(tenantId);
    if (!staffSet) {
      staffSet = new Set();
      staffBroadcastByTenant.set(tenantId, staffSet);
    }
    staffSet.add(ws);
  }
  const onDone = () => {
    const set = socketsByUser.get(key);
    set?.delete(entry);
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

function sendJsonToMatchingSockets(
  userId: string,
  data: object,
  tenantId: string | undefined,
  platformFilter?: RealtimeClientPlatform,
): boolean {
  const key = userSocketKey(userId, tenantId);
  const set = socketsByUser.get(key);
  if (!set || set.size === 0) return false;
  const payload = JSON.stringify(data);
  let delivered = false;
  for (const entry of set) {
    if (platformFilter && entry.platform !== platformFilter) continue;
    if (entry.ws.readyState === WebSocket.OPEN) {
      try {
        entry.ws.send(payload);
        delivered = true;
      } catch {
        /* ignore */
      }
    }
  }
  return delivered;
}

export function sendJsonToUser(userId: string, data: object, tenantId?: string): boolean {
  return sendJsonToMatchingSockets(userId, data, tenantId);
}

/** PC CRM → 텔레CRM Android 앱 전용 (브라우저 WS는 제외) */
export function sendJsonToTelecrmApp(userId: string, data: object, tenantId?: string): boolean {
  return sendJsonToMatchingSockets(userId, data, tenantId, 'telecrm-app');
}

/**
 * 텔레CRM dispatch 전달 — telecrm-app 소켓 우선, 없으면 단일 OPEN 소켓(구버전 APK) 폴백.
 * DB 대기열과 병행하므로 WS만으로 성공 여부를 판단하지 않는다.
 */
export function deliverTelecrmDispatch(userId: string, data: object, tenantId?: string): boolean {
  if (sendJsonToTelecrmApp(userId, data, tenantId)) return true;

  const key = userSocketKey(userId, tenantId);
  const set = socketsByUser.get(key);
  if (!set || set.size === 0) return false;

  const open = [...set].filter((entry) => entry.ws.readyState === WebSocket.OPEN);
  if (open.length !== 1) return false;

  const payload = JSON.stringify(data);
  try {
    open[0].ws.send(payload);
    return true;
  } catch {
    return false;
  }
}
