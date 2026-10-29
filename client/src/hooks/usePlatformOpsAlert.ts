import { useEffect, useRef, useState } from 'react';
import { getPlatformToken } from '../stores/platformAuth';

export type PlatformOpsAlert = {
  title: string;
  body: string;
  href: string;
  at: string;
};

function playOpsChime() {
  const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
  osc.onended = () => void ctx.close();
}

/** 플랫폼 운영자 소켓. 충전·입금·전환·PG·바로빌이 생기면 토스트용 이벤트를 연다. */
export function usePlatformOpsAlert(enabled: boolean, onAlert: (alert: PlatformOpsAlert) => void) {
  const [connected, setConnected] = useState(false);
  const onAlertRef = useRef(onAlert);
  useEffect(() => {
    onAlertRef.current = onAlert;
  });

  useEffect(() => {
    if (!enabled) return;
    const token = getPlatformToken();
    if (!token) return;
    let ws: WebSocket | null = null;
    let timer = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) timer = window.setTimeout(connect, 2000);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as {
            type?: string;
            title?: string;
            body?: string;
            href?: string;
            at?: string;
          };
          if (data.type !== 'platform:alert' || !data.title) return;
          playOpsChime();
          const alert: PlatformOpsAlert = {
            title: data.title,
            body: data.body ?? '',
            href: data.href ?? '/platform/inbox',
            at: data.at ?? new Date().toISOString(),
          };
          onAlertRef.current(alert);
          window.dispatchEvent(new CustomEvent('cbiseo:platform-alert'));
        } catch {
          /* ignore */
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      ws?.close();
    };
  }, [enabled]);

  return { connected };
}
