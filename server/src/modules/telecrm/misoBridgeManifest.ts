/** @see tools/miso-bridge/version_info.py — 설치 프로그램 버전과 맞춘다 */

const MISO_BRIDGE_MIN_VERSION = 1;
const MISO_BRIDGE_APP_VERSION = '0.3.0';

/** Release Setup.exe sha256 — Railway 변수 누락일 때 폴백. 빌드 후 채운다. */
const SETUP_SHA256_BY_VERSION: Record<string, string> = {
  '0.3.0': '2024bea750c2b6a0decd9160bce5225e0d156f1d2c2df826c9f38de4c0bf4089',
};

export type MisoBridgeManifest = {
  requiredVersion: number;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
};

function setupDownloadUrl(version: string): string {
  return `https://github.com/skcleantec/skcleantec/releases/download/miso-bridge-v${version}/MisoBridge-Setup-${version}.exe`;
}

function versionFromSetupUrl(url: string): string | null {
  const match = url.match(/MisoBridge-Setup-(\d+\.\d+\.\d+)\.exe/i);
  return match?.[1] ?? null;
}

/** 미소 연동 설치 파일 매니페스트 (공개·CRM 공용) */
export function getMisoBridgeManifest(): MisoBridgeManifest {
  const requiredVersion = parseInt(
    process.env.MISO_BRIDGE_REQUIRED_VERSION ?? String(MISO_BRIDGE_MIN_VERSION),
    10,
  );
  const latestVersion =
    process.env.MISO_BRIDGE_LATEST_VERSION?.trim() || MISO_BRIDGE_APP_VERSION;
  const envDownloadUrl = process.env.MISO_BRIDGE_DOWNLOAD_URL?.trim() || '';
  const releaseNotes = process.env.MISO_BRIDGE_RELEASE_NOTES?.trim() || '';
  const urlVersion = envDownloadUrl ? versionFromSetupUrl(envDownloadUrl) : null;
  const downloadUrl =
    envDownloadUrl && urlVersion
      ? envDownloadUrl
      : envDownloadUrl || setupDownloadUrl(latestVersion);
  const sha256 =
    process.env.MISO_BRIDGE_SHA256?.trim() || SETUP_SHA256_BY_VERSION[latestVersion] || '';

  return {
    requiredVersion: Number.isFinite(requiredVersion) ? requiredVersion : MISO_BRIDGE_MIN_VERSION,
    latestVersion,
    downloadUrl,
    releaseNotes: releaseNotes || undefined,
    sha256: sha256 || undefined,
  };
}
