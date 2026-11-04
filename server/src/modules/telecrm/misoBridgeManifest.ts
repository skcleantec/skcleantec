/** @see tools/miso-bridge/version_info.py — 설치 프로그램 버전과 맞춘다 */

const MISO_BRIDGE_MIN_VERSION = 1;
const MISO_BRIDGE_APP_VERSION = '0.3.5';

/** Release Setup.exe sha256 — Railway 변수 누락일 때 폴백. 빌드 후 채운다. */
const SETUP_SHA256_BY_VERSION: Record<string, string> = {
  '0.3.0': '2024bea750c2b6a0decd9160bce5225e0d156f1d2c2df826c9f38de4c0bf4089',
  '0.3.1': 'dc85bd8d9045ec35677a3730d78c82995f5c8ca371630ee1c3b7b10d88c467b7',
  '0.3.2': 'e0996d156a000026eba57ade0df8c0b4a3d38338f942cad8e1cc77f413ae730e',
  '0.3.3': '24261ddfabc9b589520db21e269dae1b32a37bdbbe3448b4e603c02e0ce91358',
  '0.3.4': '98ffa7e220053f8c890fe07008c5664cb4d3e2953f73a5b29d2479893290268f',
  '0.3.5': '89a93d1dc0a6da366e2ef529ec1a4dedbdb9c57ac7ac3f5e04589a16993cb8a9',
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

function parseSemver(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((piece) => {
      const n = parseInt(piece, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

function compareSemver(a: string, b: string): number {
  const aa = parseSemver(a);
  const bb = parseSemver(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 미소 연동 설치 파일 매니페스트 (공개·CRM 공용) */
export function getMisoBridgeManifest(): MisoBridgeManifest {
  const requiredVersion = parseInt(
    process.env.MISO_BRIDGE_REQUIRED_VERSION ?? String(MISO_BRIDGE_MIN_VERSION),
    10,
  );
  const envLatest = process.env.MISO_BRIDGE_LATEST_VERSION?.trim() || MISO_BRIDGE_APP_VERSION;
  const latestVersion =
    compareSemver(envLatest, MISO_BRIDGE_APP_VERSION) < 0 ? MISO_BRIDGE_APP_VERSION : envLatest;
  const envDownloadUrl = process.env.MISO_BRIDGE_DOWNLOAD_URL?.trim() || '';
  const releaseNotes = process.env.MISO_BRIDGE_RELEASE_NOTES?.trim() || '';
  const urlVersion = envDownloadUrl ? versionFromSetupUrl(envDownloadUrl) : null;
  const downloadUrl =
    envDownloadUrl && urlVersion === latestVersion
      ? envDownloadUrl
      : setupDownloadUrl(latestVersion);
  const knownSha = SETUP_SHA256_BY_VERSION[latestVersion];
  const sha256 = knownSha || process.env.MISO_BRIDGE_SHA256?.trim() || '';

  return {
    requiredVersion: Number.isFinite(requiredVersion) ? requiredVersion : MISO_BRIDGE_MIN_VERSION,
    latestVersion,
    downloadUrl,
    releaseNotes: releaseNotes || undefined,
    sha256: sha256 || undefined,
  };
}
