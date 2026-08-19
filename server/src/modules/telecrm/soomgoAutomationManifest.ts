/** @see shared/soomgoAutomation.ts — 클라이언트·문서와 값 동기화 */

const SOOMGO_AUTOMATION_APP_VERSION = '1.0.11';

/** Release ZIP sha256 — Railway 변수 누락·구버전 URL일 때 폴백 */
const ZIP_SHA256_BY_VERSION: Record<string, string> = {
  '1.0.1': '887a1790771761552f58979d682d2926cb2d33fa8eeace5109e05cb7c213a532',
  '1.0.2': '49835aa027c667072ae15ad2bbc64cfdff731ba9551b9a5fcdb98ada9e1b5640',
  '1.0.3': 'a53a3693da1ed48a739ea568d9fa7a7a879c36b406cd3c31072b7d70022c3834',
  '1.0.4': '712187b578899ba8b2860b6c71c1826f81f73a52095c8e37cc21a98f4365013f',
  '1.0.5': 'f4d4a6b9b800df189ab39444daefb52bc0a9486b4bc38b9d7cf10e8e56c539ed',
  '1.0.6': '172db2d5a79241501736fb97fd208204aeb1cdedcd18e49f1bc5d822ccf9dbe8',
  '1.0.10': 'b0478ad2901ad7866ea05f64297e5ac0eea6b50292add88b2b2dc79f8d44fc05',
};

export type SoomgoAutomationManifest = {
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
  minAppVersion?: string;
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

function zipDownloadUrl(version: string): string {
  return `https://github.com/skcleantec/skcleantec/releases/download/soomgo-automation-v${version}/SoomgoAutomation-${version}.zip`;
}

function versionFromZipUrl(url: string): string | null {
  const match = url.match(/SoomgoAutomation-(\d+\.\d+\.\d+)\.zip/i);
  return match?.[1] ?? null;
}

function normalizeManifestFields(
  latestVersion: string,
  downloadUrl: string,
  sha256: string,
): { latestVersion: string; downloadUrl: string; sha256: string } {
  let resolvedLatest = latestVersion.trim() || SOOMGO_AUTOMATION_APP_VERSION;
  if (compareSemver(resolvedLatest, SOOMGO_AUTOMATION_APP_VERSION) < 0) {
    resolvedLatest = SOOMGO_AUTOMATION_APP_VERSION;
  }

  let resolvedUrl = downloadUrl.trim();
  const urlVersion = resolvedUrl ? versionFromZipUrl(resolvedUrl) : null;
  const urlMismatch = !resolvedUrl || !urlVersion || urlVersion !== resolvedLatest;

  if (urlMismatch) {
    resolvedUrl = zipDownloadUrl(resolvedLatest);
  }

  let resolvedSha = sha256.trim();
  if (!resolvedSha) {
    resolvedSha = ZIP_SHA256_BY_VERSION[resolvedLatest] ?? resolvedSha;
  }

  return {
    latestVersion: resolvedLatest,
    downloadUrl: resolvedUrl,
    sha256: resolvedSha,
  };
}

/** 숨고 크롤링 자동화 배포 매니페스트 (공개) */
export function getSoomgoAutomationManifest(): SoomgoAutomationManifest {
  const envLatest =
    process.env.SOOMGO_AUTOMATION_LATEST_VERSION?.trim() || SOOMGO_AUTOMATION_APP_VERSION;
  const envDownloadUrl = process.env.SOOMGO_AUTOMATION_DOWNLOAD_URL?.trim() || '';
  const releaseNotes = process.env.SOOMGO_AUTOMATION_RELEASE_NOTES?.trim() || '';
  const envSha256 = process.env.SOOMGO_AUTOMATION_SHA256?.trim() || '';
  const minAppVersion = process.env.SOOMGO_AUTOMATION_MIN_APP_VERSION?.trim() || undefined;

  const normalized = normalizeManifestFields(envLatest, envDownloadUrl, envSha256);

  return {
    latestVersion: normalized.latestVersion,
    downloadUrl: normalized.downloadUrl,
    releaseNotes: releaseNotes || undefined,
    sha256: normalized.sha256 || undefined,
    minAppVersion,
  };
}
