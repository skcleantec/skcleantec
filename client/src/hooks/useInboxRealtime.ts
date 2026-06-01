import { useCallback, useEffect, useRef, useState } from 'react';
import { devDirectWsOrigin } from '../api/apiPrefix';
import { fetchCelebrationFeedHead, fetchCelebrationsSince } from '../api/celebrationFeed';
import { notifyAuthRejected } from '../api/sessionGate';
import { useVisibilityInterval } from './useVisibilityInterval';

/**
 * 서버 WS가 인증을 거부했을 때 닫는 코드들.
 * - 4001: token required (없음)
 * - 4002: invalid token (만료·서명 불일치 등)
 * - 1008: policy violation (브라우저/프록시가 정책으로 끊은 경우)
 *
 * 이 코드들이 오면 같은 토큰으로 재연결을 시도해도 영원히 실패하므로,
 * 재연결 타이머를 끄고 토큰 자동 폐기 알림(`notifyAuthRejected`)을 보낸다.
 */
const AUTH_REJECT_CLOSE_CODES = new Set<number>([4001, 4002, 1008]);

function buildWsUrl(token: string): string {
  const base = import.meta.env.VITE_WS_URL as string | undefined;
  if (base?.trim()) {
    const u = base.replace(/\/$/, '');
    return `${u}/ws?token=${encodeURIComponent(token)}`;
  }
  const direct = devDirectWsOrigin();
  if (direct) {
    return `${direct}/ws?token=${encodeURIComponent(token)}`;
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

export type RosterAckPayload = {
  type: 'inquiry:rosterAck';
  messageKo: string;
  messageTh: string;
};

/** 호환용 — 예전 이름 */
export type CrewRosterAckPayload = RosterAckPayload;

/** 구버전 서버 `crew:rosterAck` 도 수신 후 정규화 */
function parseRosterAckPayload(d: unknown): RosterAckPayload | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const t = o.type;
  if (t !== 'inquiry:rosterAck' && t !== 'crew:rosterAck') return null;
  if (typeof o.messageKo !== 'string' || typeof o.messageTh !== 'string') return null;
  return { type: 'inquiry:rosterAck', messageKo: o.messageKo, messageTh: o.messageTh };
}

type Bucket = {
  token: string;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  tearDown: boolean;
  refreshListeners: Set<() => void>;
  connectionListeners: Set<(connected: boolean) => void>;
  celebrationListeners: Set<(p: InquiryCelebratePayload) => void>;
  rosterAckListeners: Set<(p: RosterAckPayload) => void>;
};

const buckets = new Map<string, Bucket>();

function bucketHasSubscribers(bucket: Bucket): boolean {
  return (
    bucket.refreshListeners.size > 0 ||
    bucket.celebrationListeners.size > 0 ||
    bucket.rosterAckListeners.size > 0
  );
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
      const rosterAck = parseRosterAckPayload(data);
      if (rosterAck) {
        for (const fn of bucket.rosterAckListeners) {
          try {
            fn(rosterAck);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  };
  ws.onclose = (ev) => {
    notifyConnection(bucket, false);
    bucket.ws = null;
    /**
     * 토큰 만료·거부 코드면 같은 토큰으로 재연결 시도하지 않는다.
     * 클라이언트 store에 알려 토큰을 비우고 로그인 화면으로 이동시키도록 한다.
     */
    if (AUTH_REJECT_CLOSE_CODES.has(ev.code)) {
      bucket.tearDown = true;
      if (bucket.reconnectTimer) {
        clearTimeout(bucket.reconnectTimer);
        bucket.reconnectTimer = undefined;
      }
      try {
        notifyAuthRejected('ws_close', ev.code);
      } catch {
        /* ignore */
      }
      return;
    }
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
  if (
    bucket.refreshListeners.size > 0 ||
    bucket.connectionListeners.size > 0 ||
    bucket.celebrationListeners.size > 0 ||
    bucket.rosterAckListeners.size > 0
  )
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
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });
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
        rosterAckListeners: new Set(),
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
  useEffect(() => {
    onCelebrateRef.current = onCelebrate;
  });
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
        rosterAckListeners: new Set(),
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

  /** Same cadence as AdminLayout nav badge fallback (15s) when WebSocket is down. */
  useVisibilityInterval(pollCelebrations, enabled && token && !wsConnected ? 15000 : 0);
}

/** 크루·팀장 공통: 현장 팀원 구성 변경 시 상단 확인 배너 (한·태 동시 표시). */
export function useRosterAckRealtime(
  token: string | null,
  onRosterAck: (p: RosterAckPayload) => void,
  enabled: boolean
): void {
  const onRosterAckRef = useRef(onRosterAck);
  useEffect(() => {
    onRosterAckRef.current = onRosterAck;
  });

  useEffect(() => {
    if (!enabled || !token) return;

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
        rosterAckListeners: new Set(),
      };
      buckets.set(token, b);
    } else {
      b.tearDown = false;
    }

    const listener = (p: RosterAckPayload) => onRosterAckRef.current(p);
    b.rosterAckListeners.add(listener);
    const noopConn = () => {};
    b.connectionListeners.add(noopConn);
    connectBucket(b);

    return () => {
      const bucket = buckets.get(token);
      if (bucket) {
        bucket.rosterAckListeners.delete(listener);
        bucket.connectionListeners.delete(noopConn);
      }
      destroyBucketIfIdle(token);
    };
  }, [token, enabled]);
}

/** @deprecated `useRosterAckRealtime` 사용 */
export const useCrewRosterAckRealtime = useRosterAckRealtime;
