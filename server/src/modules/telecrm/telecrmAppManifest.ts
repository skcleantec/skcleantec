/** 텔레CRM Android sideload 배포 매니페스트 — Railway Variables 단일 소스 */

const TELECRM_APP_FALLBACK_VERSION_CODE = 16;
const TELECRM_APP_FALLBACK_VERSION_NAME = '0.6.6-internal';

export type TelecrmAppManifest = {
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
  distribution: 'internal';
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getTelecrmAppManifest(): TelecrmAppManifest {
  const latestVersionCode = parsePositiveInt(
    process.env.TELECRM_APP_LATEST_VERSION_CODE,
    TELECRM_APP_FALLBACK_VERSION_CODE,
  );
  const minVersionCode = parsePositiveInt(
    process.env.TELECRM_APP_MIN_VERSION_CODE,
    Math.max(1, latestVersionCode - 1),
  );
  const latestVersionName =
    process.env.TELECRM_APP_LATEST_VERSION_NAME?.trim() || TELECRM_APP_FALLBACK_VERSION_NAME;
  const downloadUrl = process.env.TELECRM_APP_DOWNLOAD_URL?.trim() || '';
  const releaseNotes = process.env.TELECRM_APP_RELEASE_NOTES?.trim() || '';
  const sha256 = process.env.TELECRM_APP_SHA256?.trim() || '';

  return {
    latestVersionCode,
    latestVersionName,
    minVersionCode: Math.min(minVersionCode, latestVersionCode),
    downloadUrl,
    releaseNotes: releaseNotes || undefined,
    sha256: sha256 || undefined,
    distribution: 'internal',
  };
}

/** mobile-config.features.connectedMinSec 등과 함께 쓰는 최소 앱 버전(semver 표시용) */
export function getTelecrmAppMinVersionName(): string {
  return process.env.TELECRM_APP_MIN_VERSION_NAME?.trim() || getTelecrmAppManifest().latestVersionName;
}
