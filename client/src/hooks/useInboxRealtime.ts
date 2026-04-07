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

type Bucket = {
  token: string;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  tearDown: boolean;
  refreshListeners: Set<() => void>;
  connectionListeners: Set<(connected: boolean) => void>;
};

const buckets = new Map<string, Bucket>();

function notifyConnection(bucket: Bucket, connected: boolean) {
  for (const fn of bucket.connectionListeners) {
    try {
      fn(connected);
    } catch {
      /* ignore */
    }
  }
}

function connectBucket(bucket: Bucket) {
  if (bucket.tearDown) return;
  if (bucket.ws && (bucket.ws.readyState === WebSocket.OPEN || bucket.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    bucket.ws = new WebSocket(buildWsUrl(bucket.token));
  } catch {
    bucket.reconnectTimer = setTimeout(() => {
      bucket.reconnectTimer = undefined;
      if (!bucket.tearDown && bucket.refreshListeners.size > 0) connectBucket(bucket);
    }, 3000);
    return;
  }

  const ws = bucket.ws;
  ws.onopen = () => notifyConnection(bucket, true);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as { type?: string };
      if (data?.type === 'inbox:refresh') {
        for (const fn of bucket.refreshListeners) {
          try {
            fn();
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  };
  ws.onclose = () => {
    notifyConnection(bucket, false);
    bucket.ws = null;
    if (bucket.tearDown || bucket.refreshListeners.size === 0) return;
    bucket.reconnectTimer = setTimeout(() => {
      bucket.reconnectTimer = undefined;
      if (!bucket.tearDown && bucket.refreshListeners.size > 0) connectBucket(bucket);
    }, 3000);
  };
  ws.onerror = () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  };
}

function destroyBucketIfIdle(token: string) {
  const bucket = buckets.get(token);
  if (!bucket) return;
  if (bucket.refreshListeners.size > 0 || bucket.connectionListeners.size > 0) return;
  bucket.tearDown = true;
  if (bucket.reconnectTimer) {
    clearTimeout(bucket.reconnectTimer);
    bucket.reconnectTimer = undefined;
  }
  try {
    bucket.ws?.close();
  } catch {
    /* ignore */
  }
  bucket.ws = null;
  buckets.delete(token);
}

/**
 * 서버 `inbox:refresh` 푸시 구독 — 새 메시지·C/S 배지 등에서 클라이언트가 GET으로 다시 불러오도록 신호만 보냄.
 * GNB 배지(미읽음·C/S)도 동일 이벤트로 갱신.
 * 동일 JWT로 여러 컴포넌트가 쓰면 WebSocket은 하나만 연결(탭당 병목 완화).
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

    let b = buckets.get(token);
    if (!b) {
      b = {
        token,
        ws: null,
        reconnectTimer: undefined,
        tearDown: false,
        refreshListeners: new Set(),
        connectionListeners: new Set(),
      };
      buckets.set(token, b);
    } else {
      b.tearDown = false;
    }

    const refresh = () => onRefreshRef.current();
    const onConn = (c: boolean) => setConnected(c);

    b.refreshListeners.add(refresh);
    b.connectionListeners.add(onConn);

    connectBucket(b);
    if (b.ws?.readyState === WebSocket.OPEN) {
      setConnected(true);
    }

    return () => {
      const bucket = buckets.get(token);
      if (bucket) {
        bucket.refreshListeners.delete(refresh);
        bucket.connectionListeners.delete(onConn);
      }
      setConnected(false);
      destroyBucketIfIdle(token);
    };
  }, [token, enabled]);

  return { connected };
}
