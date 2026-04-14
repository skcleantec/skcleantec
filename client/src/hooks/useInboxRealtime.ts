import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCelebrationFeedHead, fetchCelebrationsSince } from '../api/celebrationFeed';
import { useVisibilityInterval } from './useVisibilityInterval';

function buildWsUrl(token: string): string {
  const base = import.meta.env.VITE_WS_URL as string | undefined;
  if (base?.trim()) {
    const u = base.replace(/\/$/, '');
    return `${u}/ws?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

export type InquiryCelebratePayload = {
  type: 'inquiry:celebrate';
  /** Dedup + poll cursor (server assigns). */
  eventId?: number;
  registrarName: string;
  customerName: string;
  inquiryNumber: string | null;
  source: string | null;
};

function isCelebratePayload(d: unknown): d is InquiryCelebratePayload {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return (
    o.type === 'inquiry:celebrate' &&
    typeof o.registrarName === 'string' &&
    typeof o.customerName === 'string'
  );
}

type Bucket = {
  token: string;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  tearDown: boolean;
  refreshListeners: Set<() => void>;
  connectionListeners: Set<(connected: boolean) => void>;
  celebrationListeners: Set<(p: InquiryCelebratePayload) => void>;
};

const buckets = new Map<string, Bucket>();

function bucketHasSubscribers(bucket: Bucket): boolean {
  return bucket.refreshListeners.size > 0 || bucket.celebrationListeners.size > 0;
}

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
      if (!bucket.tearDown && bucketHasSubscribers(bucket)) connectBucket(bucket);
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
      if (isCelebratePayload(data)) {
        for (const fn of bucket.celebrationListeners) {
          try {
            fn(data);
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
    if (bucket.tearDown || !bucketHasSubscribers(bucket)) return;
    bucket.reconnectTimer = setTimeout(() => {
      bucket.reconnectTimer = undefined;
      if (!bucket.tearDown && bucketHasSubscribers(bucket)) connectBucket(bucket);
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
  if (bucket.refreshListeners.size > 0 || bucket.connectionListeners.size > 0 || bucket.celebrationListeners.size > 0)
    return;
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
 * Subscribe to inbox:refresh over /ws (refetch messages, nav badges). One socket per JWT.
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
        celebrationListeners: new Set(),
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

/**
 * Staff-only inquiry:celebrate toast; uses WebSocket when available, otherwise HTTP poll
 * (proxies like Cloudflare may block /ws).
 */
export function useInquiryCelebrateRealtime(
  token: string | null,
  onCelebrate: (p: InquiryCelebratePayload) => void,
  enabled: boolean
): void {
  const onCelebrateRef = useRef(onCelebrate);
  onCelebrateRef.current = onCelebrate;
  const lastEventIdRef = useRef(0);
  const bootstrappedRef = useRef(false);
  const seenIdsRef = useRef(new Set<number>());
  const [wsConnected, setWsConnected] = useState(false);

  const emitCelebrate = useCallback((p: InquiryCelebratePayload) => {
    if (typeof p.eventId === 'number') {
      if (seenIdsRef.current.has(p.eventId)) return;
      seenIdsRef.current.add(p.eventId);
      while (seenIdsRef.current.size > 64) {
        const first = seenIdsRef.current.values().next().value;
        if (first !== undefined) seenIdsRef.current.delete(first);
      }
      lastEventIdRef.current = Math.max(lastEventIdRef.current, p.eventId);
    }
    onCelebrateRef.current(p);
  }, []);

  useEffect(() => {
    if (!enabled || !token) {
      setWsConnected(false);
      return;
    }
    lastEventIdRef.current = 0;
    bootstrappedRef.current = false;
    seenIdsRef.current.clear();

    let b = buckets.get(token);
    if (!b) {
      b = {
        token,
        ws: null,
        reconnectTimer: undefined,
        tearDown: false,
        refreshListeners: new Set(),
        connectionListeners: new Set(),
        celebrationListeners: new Set(),
      };
      buckets.set(token, b);
    } else {
      b.tearDown = false;
    }

    const listener = (p: InquiryCelebratePayload) => emitCelebrate(p);
    b.celebrationListeners.add(listener);
    const onConn = (c: boolean) => setWsConnected(c);
    b.connectionListeners.add(onConn);
    connectBucket(b);
    if (b.ws?.readyState === WebSocket.OPEN) setWsConnected(true);

    return () => {
      const bucket = buckets.get(token);
      if (bucket) {
        bucket.celebrationListeners.delete(listener);
        bucket.connectionListeners.delete(onConn);
      }
      setWsConnected(false);
      destroyBucketIfIdle(token);
    };
  }, [token, enabled, emitCelebrate]);

  const pollCelebrations = useCallback(() => {
    if (!enabled || !token) return;
    if (wsConnected) return;
    void (async () => {
      try {
        if (!bootstrappedRef.current) {
          const head = await fetchCelebrationFeedHead(token);
          bootstrappedRef.current = true;
          lastEventIdRef.current = Math.max(lastEventIdRef.current, head.lastId);
          return;
        }
        const r = await fetchCelebrationsSince(token, lastEventIdRef.current);
        lastEventIdRef.current = Math.max(lastEventIdRef.current, r.lastId);
        for (const item of r.items) {
          emitCelebrate(item as InquiryCelebratePayload);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [enabled, token, wsConnected, emitCelebrate]);

  useVisibilityInterval(pollCelebrations, enabled && token && !wsConnected ? 6000 : 0);
}
