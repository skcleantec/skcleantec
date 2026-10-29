import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isPlatformAuthPayload } from '../platform/platformAuth.types.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { registerPlatformSocket, registerUserSocket } from './realtimeHub.js';

/**
 * 인박스 실시간 갱신용 WebSocket — 경로 /ws?token=JWT
 * Express와 동일 HTTP 서버에 붙음 (Railway 등 단일 포트)
 */
export function attachInboxWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    void (async () => {
      try {
        const host = req.headers.host ?? 'localhost';
        const url = new URL(req.url ?? '', `http://${host}`);
        const token = url.searchParams.get('token');
        if (!token) {
          ws.close(4001, 'token required');
          return;
        }
        const decoded = jwt.verify(token, config.jwtSecret);
        if (isPlatformAuthPayload(decoded)) {
          registerPlatformSocket(decoded.platformUserId, ws);
          try {
            ws.send(JSON.stringify({ type: 'connected', v: 1, scope: 'platform' }));
          } catch {
            /* ignore */
          }
          return;
        }
        const payload = decoded as AuthPayload;
        if (!payload.userId) {
          ws.close(4002, 'invalid token');
          return;
        }
        const client = url.searchParams.get('client')?.trim().toLowerCase();
        const platform = client === 'telecrm-app' ? 'telecrm-app' : 'web';
        const tenantId =
          payload.tenantId ?? (await resolveTenantIdFromAuth(payload)) ?? undefined;
        registerUserSocket(payload.userId, payload.role ?? '', ws, tenantId, platform);
        try {
          ws.send(JSON.stringify({ type: 'connected', v: 1 }));
        } catch {
          /* ignore */
        }
      } catch {
        ws.close(4002, 'invalid token');
      }
    })();
  });

  console.info('[ws] /ws (inbox refresh)');
}
