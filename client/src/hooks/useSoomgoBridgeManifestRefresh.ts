import { useCallback, useEffect } from 'react';
import type { SoomgoBridgeManifest } from '@shared/soomgoBridge';
import { fetchTelecrmSoomgoBridgeManifest } from '../api/telecrmSoomgo';
import { getToken } from '../stores/auth';
import { useVisibilityInterval } from './useVisibilityInterval';

/** 서버 manifest — 업데이트 직후에도 최신 URL을 받도록 짧은 주기 + 포커스 재조회 */
const MANIFEST_POLL_MS = 60 * 1000;

/** 텔레CRM — 서버 브릿지 manifest 주기·포커스 재조회 */
export function useSoomgoBridgeManifestRefresh(
  enabled: boolean,
  onManifest: (manifest: SoomgoBridgeManifest) => void,
): { refreshManifest: () => Promise<SoomgoBridgeManifest | null> } {
  const refresh = useCallback(async (): Promise<SoomgoBridgeManifest | null> => {
    const token = getToken();
    if (!token) return null;
    try {
      const manifest = await fetchTelecrmSoomgoBridgeManifest(token);
      onManifest(manifest);
      return manifest;
    } catch {
      return null;
    }
  }, [onManifest]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useVisibilityInterval(refresh, enabled ? MANIFEST_POLL_MS : 0);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enabled, refresh]);

  return { refreshManifest: refresh };
}
