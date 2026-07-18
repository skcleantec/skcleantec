/** @see shared/soomgoBridge.ts — 클라이언트와 값 동기화 */

const SOOMGO_BRIDGE_MIN_VERSION = 2;
const SOOMGO_BRIDGE_APP_VERSION = '2.2.18';

/** Release Setup.exe sha256 — Railway 변수 누락·구버전 URL일 때 폴백 */
const SETUP_SHA256_BY_VERSION: Record<string, string> = {
  '2.2.18': 'd9da706b1338fbfc29d2fdd56ddfe862f8df7543fcf989af1ebefb6d5d1705b1',
};

export type SoomgoBridgeManifest = {
  requiredVersion: number;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
};

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

function setupDownloadUrl(version: string): string {
  return `https://github.com/skcleantec/skcleantec/releases/download/soomgo-bridge-v${version}/SoomgoBridge-Setup-${version}.exe`;
}

function versionFromSetupUrl(url: string): string | null {
  const match = url.match(/SoomgoBridge-Setup-(\d+\.\d+\.\d+)\.exe/i);
  return match?.[1] ?? null;
}

/** Railway 변수가 구버전 URL·sha256을 가리킬 때 코드 기준으로 보정 */
function normalizeManifestFields(
  latestVersion: string,
  downloadUrl: string,
  sha256: string,
): { latestVersion: string; downloadUrl: string; sha256: string } {
  let resolvedLatest = latestVersion.trim() || SOOMGO_BRIDGE_APP_VERSION;
  if (compareSemver(resolvedLatest, SOOMGO_BRIDGE_APP_VERSION) < 0) {
    resolvedLatest = SOOMGO_BRIDGE_APP_VERSION;
  }

  let resolvedUrl = downloadUrl.trim();
  const urlVersion = resolvedUrl ? versionFromSetupUrl(resolvedUrl) : null;
  const urlMismatch = !resolvedUrl || !urlVersion || urlVersion !== resolvedLatest;

  if (urlMismatch) {
    resolvedUrl = setupDownloadUrl(resolvedLatest);
  }

  let resolvedSha = sha256.trim();
  if (urlMismatch || !resolvedSha) {
    resolvedSha = SETUP_SHA256_BY_VERSION[resolvedLatest] ?? resolvedSha;
  }

  return {
    latestVersion: resolvedLatest,
    downloadUrl: resolvedUrl,
    sha256: resolvedSha,
  };
}

/** 숨고 데스크톱 브릿지 배포 매니페스트 (공개·CRM 공용) */
export function getSoomgoBridgeManifest(): SoomgoBridgeManifest {
  const requiredVersion = parseInt(
    process.env.SOOMGO_BRIDGE_REQUIRED_VERSION ?? String(SOOMGO_BRIDGE_MIN_VERSION),
    10,
  );
  const envLatest = process.env.SOOMGO_BRIDGE_LATEST_VERSION?.trim() || SOOMGO_BRIDGE_APP_VERSION;
  const envDownloadUrl = process.env.SOOMGO_BRIDGE_DOWNLOAD_URL?.trim() || '';
  const releaseNotes = process.env.SOOMGO_BRIDGE_RELEASE_NOTES?.trim() || '';
  const envSha256 = process.env.SOOMGO_BRIDGE_SHA256?.trim() || '';

  const normalized = normalizeManifestFields(envLatest, envDownloadUrl, envSha256);

  return {
    requiredVersion: Number.isFinite(requiredVersion) ? requiredVersion : SOOMGO_BRIDGE_MIN_VERSION,
    latestVersion: normalized.latestVersion,
    downloadUrl: normalized.downloadUrl,
    releaseNotes: releaseNotes || undefined,
    sha256: normalized.sha256 || undefined,
  };
}
