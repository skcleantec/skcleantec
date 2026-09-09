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

const KAKAO_NAVI_PKG = 'com.locnall.KimGiSa';
const TMAP_PKG = 'com.skt.tmap.ku';
const KAKAO_NAVI_STORE = `https://play.google.com/store/apps/details?id=${KAKAO_NAVI_PKG}`;
const TMAP_STORE = `https://play.google.com/store/apps/details?id=${TMAP_PKG}`;

export function canLaunchStaffFieldNavi(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCbiseoStaffNativeApp()) return true;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Play 38부터 `openNavi` 실구현. WebView는 없는 메서드도 typeof === 'function' 으로 나와 쓰면 안 됨 */
const STAFF_NAVI_NATIVE_MIN_VERSION = 38;

export function canUseNativeStaffNavi(): boolean {
  const code = getCbiseoStaffAppVersionCode();
  return code !== null && code >= STAFF_NAVI_NATIVE_MIN_VERSION;
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

/** Android intent:// — 패키지 지정으로 카카오내비·TMAP을 직접 연다 */
export function buildStaffFieldNaviIntentUrl(
  app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
  fallbackHttps?: string,
): string {
  const fallback = encodeURIComponent(fallbackHttps ?? httpsUrlForStaffFieldNavi(app, dest));
  if (app === 'kakaonavi') {
    const q = new URLSearchParams({
      name: dest.name,
      x: String(dest.lng),
      y: String(dest.lat),
      coord_type: 'wgs84',
    });
    return `intent://navigate?${q.toString()}#Intent;scheme=kakaonavi;package=${KAKAO_NAVI_PKG};S.browser_fallback_url=${fallback};end`;
  }
  const q = new URLSearchParams({
    referrer: 'com.cbiseo.app',
    goalx: String(dest.lng),
    goaly: String(dest.lat),
    goalname: dest.name,
  });
  return `intent://route?${q.toString()}#Intent;scheme=tmap;package=${TMAP_PKG};S.browser_fallback_url=${fallback};end`;
}

/** 설치 앱 선택 창 — 카카오내비·TMAP·지도가 geo를 받음. Chrome으로 앱을 죽이지 않음 */
export function buildGeoNaviUrl(dest: StaffFieldNaviDestination): string {
  const label = encodeURIComponent(dest.name || '현장');
  return `geo:${dest.lat},${dest.lng}?q=${dest.lat},${dest.lng}(${label})`;
}

export function storeUrlForStaffFieldNavi(app: StaffFieldNaviApp): string {
  return app === 'kakaonavi' ? KAKAO_NAVI_STORE : TMAP_STORE;
}

/** 구 앱 WebView는 kakaonavi:// 를 무시함 — https만 shouldOverride → 외부 실행 */
export function buildKakaoMapHttpsUrl(dest: StaffFieldNaviDestination): string {
  const name = encodeURIComponent(dest.name || '현장');
  return `https://map.kakao.com/link/to/${name},${dest.lat},${dest.lng}`;
}

export function buildTmapHttpsUrl(dest: StaffFieldNaviDestination): string {
  const q = new URLSearchParams({
    api: '1',
    destination: `${dest.lat},${dest.lng}`,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

export function httpsUrlForStaffFieldNavi(app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): string {
  return app === 'kakaonavi' ? buildKakaoMapHttpsUrl(dest) : buildTmapHttpsUrl(dest);
}

function openWithoutNavigatingWebView(url: string): void {
  if (isCbiseoStaffNativeApp()) {
    openStaffAppExternalUrl(url);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function callStaffBridgeOpenExternal(url: string): void {
  const openExt = window.CbiseoApp?.openExternalUrl;
  if (!openExt) return;
  try {
    openExt(url);
  } catch {
    /* 구 앱·R8 제거 */
  }
}

export function launchStaffFieldNavi(app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): void {
  const https = httpsUrlForStaffFieldNavi(app, dest);
  const intentUrl = buildStaffFieldNaviIntentUrl(app, dest, https);

  if (!isCbiseoStaffNativeApp()) {
    openWithoutNavigatingWebView(https);
    return;
  }

  /**
   * 38에서 openNavi만 호출하고 return 하면, R8/미구현 시 아무 일도 안 남.
   * 38에 이미 있는 openExternalUrl(intent://)로 내비를 열고, 안 켜지면 지도 https.
   */
  try {
    const openNavi = window.CbiseoApp?.openNavi;
    if (openNavi && canUseNativeStaffNavi()) {
      try {
        openNavi(app, String(dest.lat), String(dest.lng), dest.name || '현장');
      } catch {
        /* openNavi 없음 */
      }
    }
  } catch {
    /* 브릿지 없음 */
  }
  callStaffBridgeOpenExternal(intentUrl);
  window.setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    callStaffBridgeOpenExternal(https);
    try {
      window.location.assign(https);
    } catch {
      /* WebView 이동 거부 */
    }
  }, 800);
}
