import { useCallback, useRef } from 'react';
import { useInboxRealtime } from './useInboxRealtime';
import { useVisibilityInterval } from './useVisibilityInterval';

const SILENT_REFRESH_MS = 4000;

/**
 * 검수(청소 전·후·현장) 화면 — inbox:refresh 수신 시 checklist silent 재조회.
 */
export function useInspectionChecklistRealtime(
  token: string | null,
  reload: () => void | Promise<void>,
  enabled: boolean,
): { connected: boolean } {
  const lastRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRef.current < SILENT_REFRESH_MS) return;
    lastRef.current = now;
    void reload();
  }, [reload]);

  const { connected } = useInboxRealtime(token, silentRefresh, enabled && Boolean(token));
  useVisibilityInterval(silentRefresh, enabled && token && !connected ? 20000 : 0);
  return { connected };
}
