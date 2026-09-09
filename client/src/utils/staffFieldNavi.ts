import {
  getCbiseoStaffAppVersionCode,
  isCbiseoStaffNativeApp,
  openStaffAppExternalUrl,
} from './cbiseoNativeApp';

export type StaffFieldNaviApp = 'kakaonavi' | 'tmap';

export type StaffFieldNaviDestination = {
  lat: number;
  lng: number;
  name: string;
};

const KAKAO_NAVI_STORE = 'https://play.google.com/store/apps/details?id=com.locnall.KimGiSa';
const TMAP_STORE = 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';
/** 커스텀 스킴을 WebView가 삼키는 구 앱(v32 이하)부터 외부 https를 연다 */
const NATIVE_SCHEME_MIN_VERSION = 33;

export function canLaunchStaffFieldNavi(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCbiseoStaffNativeApp()) return true;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function buildKakaoNaviUrl(dest: StaffFieldNaviDestination): string {
  const q = new URLSearchParams({
    name: dest.name,
    x: String(dest.lng),
    y: String(dest.lat),
    coord_type: 'wgs84',
  });
  return `kakaonavi://navigate?${q.toString()}`;
}

export function buildTmapNaviUrl(dest: StaffFieldNaviDestination): string {
  const q = new URLSearchParams({
    referrer: 'com.cbiseo.app',
    goalx: String(dest.lng),
    goaly: String(dest.lat),
    goalname: dest.name,
  });
  return `tmap://route?${q.toString()}`;
}

/** 카카오맵 길찾기 — https라 구 Play 앱 WebView에서도 Chrome으로 열림 */
export function buildKakaoMapHttpsUrl(dest: StaffFieldNaviDestination): string {
  const label = encodeURIComponent(dest.name || '현장');
  return `https://map.kakao.com/link/to/${label},${dest.lat},${dest.lng}`;
}

/** 구글 지도 자동차 경로 — TMAP 스킴 실패 시 */
export function buildGoogleMapsHttpsUrl(dest: StaffFieldNaviDestination): string {
  const q = new URLSearchParams({
    api: '1',
    destination: `${dest.lat},${dest.lng}`,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

export function httpsFallbackForStaffFieldNavi(
  app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
): string {
  return app === 'kakaonavi' ? buildKakaoMapHttpsUrl(dest) : buildGoogleMapsHttpsUrl(dest);
}

export function storeUrlForStaffFieldNavi(app: StaffFieldNaviApp): string {
  return app === 'kakaonavi' ? KAKAO_NAVI_STORE : TMAP_STORE;
}

function nativeSupportsCustomNaviScheme(): boolean {
  const code = getCbiseoStaffAppVersionCode();
  return code != null && Number.isFinite(code) && code >= NATIVE_SCHEME_MIN_VERSION;
}

export function launchStaffFieldNavi(app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): void {
  const scheme = app === 'kakaonavi' ? buildKakaoNaviUrl(dest) : buildTmapNaviUrl(dest);
  const https = httpsFallbackForStaffFieldNavi(app, dest);
  const store = storeUrlForStaffFieldNavi(app);

  if (isCbiseoStaffNativeApp()) {
    if (nativeSupportsCustomNaviScheme()) {
      openStaffAppExternalUrl(scheme);
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          openStaffAppExternalUrl(https);
        }
      }, 1400);
      return;
    }
    /** v32 이하: kakaonavi:// · tmap:// 는 WebView가 삼키거나 패키지 조회로 실패 → 반응 없음 */
    openStaffAppExternalUrl(https);
    return;
  }

  const started = Date.now();
  window.location.href = scheme;
  window.setTimeout(() => {
    if (Date.now() - started < 2500 && document.visibilityState === 'visible') {
      window.location.href = https || store;
    }
  }, 1200);
}
