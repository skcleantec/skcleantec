import { WebSocket } from 'ws';

/** userId → 연결(같은 유저가 여러 탭 가능) */
const socketsByUser = new Map<string, Set<WebSocket>>();

export function registerUserSocket(userId: string, ws: WebSocket): void {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  set.add(ws);
  const onDone = () => {
    set?.delete(ws);
    if (set && set.size === 0) socketsByUser.delete(userId);
    ws.off('close', onDone);
    ws.off('error', onDone);
  };
  ws.on('close', onDone);
  ws.on('error', onDone);
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
