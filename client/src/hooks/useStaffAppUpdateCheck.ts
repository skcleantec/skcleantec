import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StaffAppPublicManifest } from '@shared/staffAppManifest';
import { fetchStaffAppPublicManifest } from '../api/staffAppManifest';
import {
  dismissStaffAppOptionalUpdate,
  isStaffAppOptionalUpdateDismissed,
  readStaffAppPlayUpdateStatus,
  refreshStaffAppPlayUpdateStatus,
  resolveStaffAppUpdateKind,
  type StaffAppPlayUpdateStatus,
} from '../utils/staffAppUpdate';
import { getCbiseoStaffAppVersionCode, isCbiseoStaffNativeApp } from '../utils/cbiseoNativeApp';

export type StaffAppUpdateCheckState = {
  enabled: boolean;
  loading: boolean;
  manifest: StaffAppPublicManifest | null;
  playStatus: StaffAppPlayUpdateStatus | null;
  clientVersionCode: number | null;
  kind: ReturnType<typeof resolveStaffAppUpdateKind>;
  optionalDismissed: boolean;
  error: string | null;
  checkNow: (opts?: { manual?: boolean }) => Promise<void>;
  dismissOptional: () => void;
};

export function useStaffAppUpdateCheck(): StaffAppUpdateCheckState {
  const enabled = isCbiseoStaffNativeApp();
  const [loading, setLoading] = useState(false);
  const [manifest, setManifest] = useState<StaffAppPublicManifest | null>(null);
  const [playStatus, setPlayStatus] = useState<StaffAppPlayUpdateStatus | null>(() =>
    enabled ? readStaffAppPlayUpdateStatus() : null,
  );
  const [optionalDismissed, setOptionalDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientVersionCode = playStatus?.clientVersionCode ?? getCbiseoStaffAppVersionCode();

  const kind = useMemo(
    () => resolveStaffAppUpdateKind(manifest, playStatus),
    [manifest, playStatus],
  );

  const checkNow = useCallback(
    async (opts?: { manual?: boolean }) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        if (opts?.manual) {
          refreshStaffAppPlayUpdateStatus();
        }
        const nextManifest = await fetchStaffAppPublicManifest();
        setManifest(nextManifest);
        setOptionalDismissed(
          opts?.manual ? false : isStaffAppOptionalUpdateDismissed(nextManifest.latestVersionCode),
        );
        const cached = readStaffAppPlayUpdateStatus();
        if (cached) setPlayStatus(cached);
      } catch (e) {
        setError(e instanceof Error ? e.message : '업데이트 확인 실패');
      } finally {
        setLoading(false);
      }
    },
    [enabled],
  );

  const dismissOptional = useCallback(() => {
    if (!manifest) return;
    dismissStaffAppOptionalUpdate(manifest.latestVersionCode);
    setOptionalDismissed(true);
  }, [manifest]);

  useEffect(() => {
    if (!enabled) return;
    void checkNow();
  }, [enabled, checkNow]);

  useEffect(() => {
    if (!enabled) return;
    const onPlayStatus = (event: Event) => {
      const detail = (event as CustomEvent<StaffAppPlayUpdateStatus>).detail;
      if (detail && typeof detail === 'object') {
        setPlayStatus(detail);
      } else {
        setPlayStatus(readStaffAppPlayUpdateStatus());
      }
    };
    const onResume = () => {
      refreshStaffAppPlayUpdateStatus();
      void checkNow();
    };
    window.addEventListener('cbiseo:app-update-status', onPlayStatus);
    window.addEventListener('cbiseo:staff-resume', onResume);
    return () => {
      window.removeEventListener('cbiseo:app-update-status', onPlayStatus);
      window.removeEventListener('cbiseo:staff-resume', onResume);
    };
  }, [enabled, checkNow]);

  useEffect(() => {
    if (!manifest) return;
    setOptionalDismissed(isStaffAppOptionalUpdateDismissed(manifest.latestVersionCode));
  }, [manifest]);

  return {
    enabled,
    loading,
    manifest,
    playStatus,
    clientVersionCode,
    kind,
    optionalDismissed,
    error,
    checkNow,
    dismissOptional,
  };
}
