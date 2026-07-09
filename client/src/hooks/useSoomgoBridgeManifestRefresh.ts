import { useCallback, useEffect } from 'react';
import type { SoomgoBridgeManifest } from '@shared/soomgoBridge';
import { fetchTelecrmSoomgoBridgeManifest } from '../api/telecrmSoomgo';
import { getToken } from '../stores/auth';
import { useVisibilityInterval } from './useVisibilityInterval';

const MANIFEST_POLL_MS = 5 * 60 * 1000;

/** 텔레CRM — 서버 브릿지 manifest 주기·포커스 재조회 */
export function useSoomgoBridgeManifestRefresh(
  enabled: boolean,
  onManifest: (manifest: SoomgoBridgeManifest) => void,
) {
  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const manifest = await fetchTelecrmSoomgoBridgeManifest(token);
      onManifest(manifest);
    } catch {
      /* 다운로드 URL 없을 때 무시 */
    }
  }, [onManifest]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useVisibilityInterval(refresh, enabled ? MANIFEST_POLL_MS : 0);
}
