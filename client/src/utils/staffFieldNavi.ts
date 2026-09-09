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
/** TMAP 안드로이드 공식 안내 — 다른 값이면 목적지가 안 잡히거나 앱이 안 열림 */
const TMAP_REFERRER = 'com.skt.Tmap';

export function canLaunchStaffFieldNavi(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCbiseoStaffNativeApp()) return true;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const STAFF_NAVI_NATIVE_MIN_VERSION = 38;

export function canUseNativeStaffNavi(): boolean {
  const code = getCbiseoStaffAppVersionCode();
  return code !== null && code >= STAFF_NAVI_NATIVE_MIN_VERSION;
}

export function buildKakaoNaviUrl(dest: StaffFieldNaviDestination): string {
  const name = encodeURIComponent(dest.name || '현장');
  return `kakaonavi://navigate?name=${name}&x=${dest.lng}&y=${dest.lat}&coord_type=wgs84`;
}

export function buildTmapNaviUrl(dest: StaffFieldNaviDestination): string {
  const name = encodeURIComponent(dest.name || '현장');
  return `tmap://route?referrer=${TMAP_REFERRER}&goalx=${dest.lng}&goaly=${dest.lat}&goalname=${name}`;
}

export function schemeUrlForStaffFieldNavi(
  app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
): string {
  return app === 'tmap' ? buildTmapNaviUrl(dest) : buildKakaoNaviUrl(dest);
}

/** Android intent:// — 지도 https 폴백 넣지 않음(구글지도가 앱 안으로 열림) */
export function buildStaffFieldNaviIntentUrl(
  app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
  pkg?: string,
): string {
  if (app === 'kakaonavi') {
    const name = encodeURIComponent(dest.name || '현장');
    return `intent://navigate?name=${name}&x=${dest.lng}&y=${dest.lat}&coord_type=wgs84#Intent;scheme=kakaonavi;package=${KAKAO_NAVI_PKG};end`;
  }
  const name = encodeURIComponent(dest.name || '현장');
  const target = pkg ?? TMAP_PKG;
  return `intent://route?referrer=${TMAP_REFERRER}&goalx=${dest.lng}&goaly=${dest.lat}&goalname=${name}#Intent;scheme=tmap;package=${target};end`;
}

export function buildGeoNaviUrl(dest: StaffFieldNaviDestination): string {
  const label = encodeURIComponent(dest.name || '현장');
  return `geo:${dest.lat},${dest.lng}?q=${dest.lat},${dest.lng}(${label})`;
}

export function storeUrlForStaffFieldNavi(app: StaffFieldNaviApp): string {
  return app === 'kakaonavi' ? KAKAO_NAVI_STORE : TMAP_STORE;
}

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
    /* 구 앱 */
  }
}

export function launchStaffFieldNavi(app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): void {
  const schemeUrl = schemeUrlForStaffFieldNavi(app, dest);

  if (!isCbiseoStaffNativeApp()) {
    openWithoutNavigatingWebView(schemeUrl);
    return;
  }

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

  /** tmap:// · kakaonavi:// 만 외부로. 패키지 intent는 실패 시 스토어가 덮어씀 */
  callStaffBridgeOpenExternal(schemeUrl);
}
