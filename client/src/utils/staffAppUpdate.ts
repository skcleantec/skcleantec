import type { StaffAppPublicManifest, StaffAppUpdateUiKind } from '@shared/staffAppManifest';
import { resolveStaffAppUpdateUiKind } from '@shared/staffAppManifest';
import { getCbiseoStaffAppVersionCode, isCbiseoStaffNativeApp } from './cbiseoNativeApp';

export type StaffAppPlayUpdateStatus = {
  playUpdateAvailable?: boolean;
  installStatus?: string;
  allowedFlexible?: boolean;
  allowedImmediate?: boolean;
  clientVersionCode?: number;
  clientVersionName?: string;
};

export function readStaffAppPlayUpdateStatus(): StaffAppPlayUpdateStatus | null {
  if (!isCbiseoStaffNativeApp()) return null;
  try {
    const raw = window.CbiseoApp?.getAppUpdateStatusJson?.();
    if (!raw?.trim()) return null;
    return JSON.parse(raw) as StaffAppPlayUpdateStatus;
  } catch {
    return null;
  }
}

export function refreshStaffAppPlayUpdateStatus(): void {
  if (!isCbiseoStaffNativeApp()) return;
  try {
    window.CbiseoApp?.refreshAppUpdateStatus?.();
  } catch {
    /* bridge 미연결 */
  }
}

export function startStaffAppUpdate(mode: 'flexible' | 'immediate'): void {
  if (!isCbiseoStaffNativeApp()) return;
  try {
    if (typeof window.CbiseoApp?.startAppUpdate === 'function') {
      window.CbiseoApp.startAppUpdate(mode);
      return;
    }
  } catch {
    /* bridge 미연결 */
  }
  openStaffAppPlayStore(undefined);
}

export function completeStaffFlexibleAppUpdate(): void {
  if (!isCbiseoStaffNativeApp()) return;
  try {
    window.CbiseoApp?.completeFlexibleAppUpdate?.();
  } catch {
    /* bridge 미연결 */
  }
}

const STAFF_APP_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cbiseo.app';

export function openStaffAppPlayStore(playStoreUrl?: string | null): void {
  const url = playStoreUrl?.trim() || STAFF_APP_PLAY_STORE_URL;
  if (isCbiseoStaffNativeApp()) {
    try {
      if (typeof window.CbiseoApp?.openPlayStore === 'function') {
        window.CbiseoApp.openPlayStore();
        return;
      }
    } catch {
      /* fallback below */
    }
  }
  // Android WebView에서 window.open은 무시되는 경우가 많음 — 동일 탭 이동으로 Play Store 연다.
  window.location.href = url;
}

export function getStaffAppVersionNameFromBridge(): string | null {
  if (!isCbiseoStaffNativeApp()) return null;
  try {
    const name = window.CbiseoApp?.getAppVersionName?.()?.trim();
    return name || null;
  } catch {
    return null;
  }
}

export function resolveStaffAppUpdateKind(
  manifest: StaffAppPublicManifest | null,
  playStatus: StaffAppPlayUpdateStatus | null,
): StaffAppUpdateUiKind {
  if (!manifest) return 'none';
  const clientCode = playStatus?.clientVersionCode ?? getCbiseoStaffAppVersionCode();
  return resolveStaffAppUpdateUiKind(
    clientCode,
    manifest,
    playStatus?.playUpdateAvailable,
    playStatus?.installStatus,
  );
}

const DISMISS_PREFIX = 'cbiseo_staff_app_update_dismiss_v';

export function isStaffAppOptionalUpdateDismissed(latestVersionCode: number): boolean {
  try {
    return localStorage.getItem(`${DISMISS_PREFIX}${latestVersionCode}`) === '1';
  } catch {
    return false;
  }
}

export function dismissStaffAppOptionalUpdate(latestVersionCode: number): void {
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${latestVersionCode}`, '1');
  } catch {
    /* ignore */
  }
}

export function formatStaffAppVersionLabel(
  versionName: string | null | undefined,
  versionCode: number | null | undefined,
): string {
  if (versionName && versionCode != null) return `v${versionName} (${versionCode})`;
  if (versionCode != null) return `v${versionCode}`;
  if (versionName) return `v${versionName}`;
  return '앱';
}
