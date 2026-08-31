import { CBISEO_STAFF_APP_PLAY_STORE_URL } from './cbiseoStaffAppPolicy';

/** Play 배포 청소비서 업무 앱 — Railway Variables 단일 소스 */
export const STAFF_APP_FALLBACK_VERSION_CODE = 32;
export const STAFF_APP_FALLBACK_VERSION_NAME = '1.0.0';

export type StaffAppPublicManifest = {
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  releaseNotes?: string;
  playStoreUrl: string;
  distribution: 'play';
};

export function parseStaffAppPositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function buildStaffAppPublicManifest(
  env: {
    STAFF_APP_LATEST_VERSION_CODE?: string;
    STAFF_APP_MIN_VERSION_CODE?: string;
    STAFF_APP_LATEST_VERSION_NAME?: string;
    STAFF_APP_RELEASE_NOTES?: string;
  } = {},
): StaffAppPublicManifest {
  const latestVersionCode = parseStaffAppPositiveInt(
    env.STAFF_APP_LATEST_VERSION_CODE,
    STAFF_APP_FALLBACK_VERSION_CODE,
  );
  const minVersionCode = parseStaffAppPositiveInt(
    env.STAFF_APP_MIN_VERSION_CODE,
    Math.max(1, latestVersionCode - 1),
  );
  const latestVersionName =
    env.STAFF_APP_LATEST_VERSION_NAME?.trim() || STAFF_APP_FALLBACK_VERSION_NAME;
  const releaseNotes = env.STAFF_APP_RELEASE_NOTES?.trim() || '';

  return {
    latestVersionCode,
    latestVersionName,
    minVersionCode: Math.min(minVersionCode, latestVersionCode),
    releaseNotes: releaseNotes || undefined,
    playStoreUrl: CBISEO_STAFF_APP_PLAY_STORE_URL,
    distribution: 'play',
  };
}

export type StaffAppUpdateUiKind = 'none' | 'optional' | 'required' | 'downloaded';

export function resolveStaffAppUpdateUiKind(
  clientVersionCode: number | null | undefined,
  manifest: StaffAppPublicManifest,
  playUpdateAvailable?: boolean,
  installStatus?: string,
): StaffAppUpdateUiKind {
  if (installStatus === 'DOWNLOADED') return 'downloaded';
  if (clientVersionCode == null || !Number.isFinite(clientVersionCode)) return 'none';
  if (clientVersionCode < manifest.minVersionCode) return 'required';
  if (clientVersionCode < manifest.latestVersionCode || playUpdateAvailable) return 'optional';
  return 'none';
}
