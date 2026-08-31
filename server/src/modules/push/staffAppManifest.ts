/** 청소비서 업무 Android Play 매니페스트 — Railway Variables 단일 소스 */

import { CBISEO_STAFF_APP_PLAY_STORE_URL } from '../../lib/cbiseoStaffAppPolicy.constants.js';

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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getStaffAppManifest(): StaffAppPublicManifest {
  const latestVersionCode = parsePositiveInt(
    process.env.STAFF_APP_LATEST_VERSION_CODE,
    STAFF_APP_FALLBACK_VERSION_CODE,
  );
  const minVersionCode = parsePositiveInt(
    process.env.STAFF_APP_MIN_VERSION_CODE,
    Math.max(1, latestVersionCode - 1),
  );
  const latestVersionName =
    process.env.STAFF_APP_LATEST_VERSION_NAME?.trim() || STAFF_APP_FALLBACK_VERSION_NAME;
  const releaseNotes = process.env.STAFF_APP_RELEASE_NOTES?.trim() || '';

  return {
    latestVersionCode,
    latestVersionName,
    minVersionCode: Math.min(minVersionCode, latestVersionCode),
    releaseNotes: releaseNotes || undefined,
    playStoreUrl: CBISEO_STAFF_APP_PLAY_STORE_URL,
    distribution: 'play',
  };
}
