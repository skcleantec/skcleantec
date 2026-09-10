/**
 * TMAP 공식 웹→앱 길안내.
 * SK Open API Q&A: https://openapi.sk.com/qnaCommunity/398
 * 발급: https://openapi.sk.com/ 앱 생성 → appKey, 상품 TMAP 사용 신청
 *
 * GET https://apis.openapi.sk.com/tmap/app/routes?appKey=&name=&lon=&lat=
 */
export function getTmapAppKey(): string {
  return process.env.TMAP_APP_KEY?.trim() || '';
}

export function buildOfficialTmapAppRoutesUrl(opts: {
  name: string;
  lon: number;
  lat: number;
  appKey?: string;
}): string | null {
  const appKey = (opts.appKey ?? getTmapAppKey()).trim();
  if (!appKey) return null;
  const q = new URLSearchParams({
    appKey,
    name: opts.name.trim() || '현장',
    lon: String(opts.lon),
    lat: String(opts.lat),
  });
  return `https://apis.openapi.sk.com/tmap/app/routes?${q.toString()}`;
}
