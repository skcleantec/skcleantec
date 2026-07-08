/** @see shared/soomgoBridge.ts — 클라이언트와 값 동기화 */

const SOOMGO_BRIDGE_MIN_VERSION = 2;
const SOOMGO_BRIDGE_APP_VERSION = '2.1.0';

export type SoomgoBridgeManifest = {
  requiredVersion: number;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
};

/** 숨고 데스크톱 브릿지 배포 매니페스트 (공개·CRM 공용) */
export function getSoomgoBridgeManifest(): SoomgoBridgeManifest {
  const requiredVersion = parseInt(
    process.env.SOOMGO_BRIDGE_REQUIRED_VERSION ?? String(SOOMGO_BRIDGE_MIN_VERSION),
    10,
  );
  const latestVersion = process.env.SOOMGO_BRIDGE_LATEST_VERSION?.trim() || SOOMGO_BRIDGE_APP_VERSION;
  const downloadUrl = process.env.SOOMGO_BRIDGE_DOWNLOAD_URL?.trim() || '';
  const releaseNotes = process.env.SOOMGO_BRIDGE_RELEASE_NOTES?.trim() || '';
  const sha256 = process.env.SOOMGO_BRIDGE_SHA256?.trim() || '';

  return {
    requiredVersion: Number.isFinite(requiredVersion) ? requiredVersion : SOOMGO_BRIDGE_MIN_VERSION,
    latestVersion,
    downloadUrl,
    releaseNotes: releaseNotes || undefined,
    sha256: sha256 || undefined,
  };
}
