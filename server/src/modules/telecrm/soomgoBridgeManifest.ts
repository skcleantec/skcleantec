/** @see shared/soomgoBridge.ts — 클라이언트와 값 동기화 */

const SOOMGO_BRIDGE_MIN_VERSION = 2;
const SOOMGO_BRIDGE_APP_VERSION = '2.2.46';

/** Release Setup.exe sha256 — Railway 변수 누락·구버전 URL일 때 폴백 */
const SETUP_SHA256_BY_VERSION: Record<string, string> = {
  '2.2.18': 'd9da706b1338fbfc29d2fdd56ddfe862f8df7543fcf989af1ebefb6d5d1705b1',
  '2.2.20': '547d7aaa95cbd34a9e2037e196b0c9bbff058d80bc419ba1393cb1bd7ee9d454',
  '2.2.21': '0b52810770b28756b60758dcc26fda3e7fb49b0a8921a89a66b9b0eb789c8322',
  '2.2.22': '1b830981206bb509fb5a2af26302145b35bccec76fed6908dadf0c9ea38ee756',
  '2.2.23': '94df33c6d42e6adaf5fb960c52e09c4049e30d4386eddd541fcd7e6102f9fb96',
  '2.2.24': '0ed67062be7dc1046d775df25ff9647a26f7ab557cb70d04b07eccec60ee29de',
  '2.2.25': '9d7ff8c5bdf40cde81d64484bf7800fe8a2b0d927679f8231490d67ed4089b1c',
  '2.2.26': 'b823054b12516800fd28a832f9d46bdfdc4ddc98ef6a2adeadc42849a8696794',
  '2.2.27': '65a2fa531f9974e88870d43d5f77ba4681fec070d913e98751f3dc48be75b147',
  '2.2.28': '8ecdc4d900cae7783d30db8e04081dd82f397f586c28c6a7a23f84600129b7e4',
  '2.2.29': '946f86b810b51d626caf76f84f956ba3e25f8229391488242029164a45b05643',
  '2.2.30': '9f74265713aac7e8bf3fbde8509dc787d23de0fa79c2f38edaf2f69ce9f54681',
  '2.2.31': 'b36831fa1e1a36059dd1ae24923550377b17ff87d53f3142ef425529ba17d0a4',
  '2.2.32': 'f1e817fa19a3b6499ad483dcd3fb30e40edb2b54e7753345fae1446d387f0c2f',
  '2.2.33': '9295c4bd8b5b2241fab1606c00d5d917656694311e9b8c4f33ae451cec4cf264',
  '2.2.34': 'af28026853c12655bac13a262ea1313bf60b036c300e313f674cf964e41df8eb',
  '2.2.35': '6f5810ef98e0f63caa8b4925de8cf91f6dbf00b3dc44a03c82d20ae0811b1756',
  '2.2.37': 'afc7d69d0b0c700127ac5f8d4269ae1e36900fc76cf911cf8d9725ab32fd12da',
  '2.2.38': '70200e77cc265f93e288562896dcd45ced1a4d882f58b07ec8447cb51a382ec3',
  '2.2.39': '5e9f055e81a7920c0027d650053add9c4ea767e372bd1c4e15cd0bee7d13fa2f',
  '2.2.40': '0e605c4a9b77c59100a934b2abfb84a0a89144a46db5a31a5132d3e0aca88ffb',
  '2.2.41': '658b5ad620c9206de59710c6526d9dbbff82f32ad11b39999979195faeef9d06',
  '2.2.42': '3e330edb5ecf48b927da6524a56e2859ff757a3dd4c1f29ee4a1d9073a2f71b8',
  '2.2.44': 'c532ca4bb20ccb4ed9ab861e91fb4139914dfd91bb10e8df38ed3b102cebd1ff',
  '2.2.45': 'a94a2b97526dbae82edae584d74c8751a591c239ad0989dd55a881f6aed06ea2',
  '2.2.46': '07a5580be855f0351e5f7139a8bbd99f1b73cd912ff1a4b18243a151ead0cb7d',
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
  const knownSha = SETUP_SHA256_BY_VERSION[resolvedLatest];
  if (knownSha) {
    resolvedSha = knownSha;
  } else if (urlMismatch || !resolvedSha) {
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
