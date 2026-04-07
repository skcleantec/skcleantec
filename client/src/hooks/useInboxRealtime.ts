import { useEffect, useRef, useState } from 'react';

function buildWsUrl(token: string): string {
  const base = import.meta.env.VITE_WS_URL as string | undefined;
  if (base?.trim()) {
    const u = base.replace(/\/$/, '');
    return `${u}/ws?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

/**
 * 서버 `inbox:refresh` 푸시 구독 — 메시지 생성 시 상대방 화면 즉시 갱신.
 * 토큰은 쿼리로 전달(브라우저 WebSocket 헤더에 Authorization 불가).
 */
export function useInboxRealtime(
  token: string | null,
  onRefresh: () => void,
  enabled: boolean
): { connected: boolean } {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !token) {
      setConnected(false);
      return;
    }
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(buildWsUrl(token));
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
        return;
      }
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as { type?: string };
          if (data?.type === 'inbox:refresh') onRefreshRef.current();
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [token, enabled]);

  return { connected };
}
