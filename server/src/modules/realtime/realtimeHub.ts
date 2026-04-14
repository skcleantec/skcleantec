import { WebSocket } from 'ws';

/** userId → open WebSocket tabs for that user */
const socketsByUser = new Map<string, Set<WebSocket>>();
/** ADMIN / MARKETER tabs — staff-only broadcast (e.g. inquiry celebration) */
const staffBroadcastSockets = new Set<WebSocket>();

function isStaffRole(role: string): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function registerUserSocket(userId: string, role: string, ws: WebSocket): void {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  set.add(ws);
  if (isStaffRole(role)) {
    staffBroadcastSockets.add(ws);
  }
  const onDone = () => {
    set?.delete(ws);
    staffBroadcastSockets.delete(ws);
    if (set && set.size === 0) socketsByUser.delete(userId);
    ws.off('close', onDone);
    ws.off('error', onDone);
  };
  ws.on('close', onDone);
  ws.on('error', onDone);
}

/** All connected ADMIN·MARKETER sockets (team leaders / external excluded). */
export function broadcastJsonToStaff(data: object): void {
  const payload = JSON.stringify(data);
  for (const ws of staffBroadcastSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}

export function sendJsonToUser(userId: string, data: object): void {
  const set = socketsByUser.get(userId);
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
