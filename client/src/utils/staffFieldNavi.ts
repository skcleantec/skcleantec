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
const TMAP_PKG_LEGACY = 'com.skt.skaf.l001mtm091';
const KAKAO_NAVI_STORE = `https://play.google.com/store/apps/details?id=${KAKAO_NAVI_PKG}`;
const TMAP_STORE = `https://play.google.com/store/apps/details?id=${TMAP_PKG}`;
/** TMAP 지원이 Android 연동에 안내한 referrer */
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

/** TMAP 지원 안내: tmap://route?referrer=com.skt.Tmap&goalx&goaly&goalname */
export function buildTmapNaviUrl(dest: StaffFieldNaviDestination): string {
  const name = encodeURIComponent(dest.name || '현장');
  return `tmap://route?referrer=${TMAP_REFERRER}&goalx=${dest.lng}&goaly=${dest.lat}&goalname=${name}`;
}

export function schemeUrlForStaffFieldNavi(
  app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
): string {
  return app === 'tmap' ? buildTmapBrowsableIntentUrl(dest) : buildKakaoNaviUrl(dest);
}

/**
 * 38 앱 openExternalUrl(intent://)용.
 * TMAP은 BROWSABLE 카테고리가 있어야 받음 (스키마만내면 ActivityNotFound).
 */
export function buildTmapBrowsableIntentUrl(
  dest: StaffFieldNaviDestination,
  pkg: string = TMAP_PKG,
): string {
  const name = encodeURIComponent(dest.name || '현장');
  const q = `referrer=${TMAP_REFERRER}&goalx=${dest.lng}&goaly=${dest.lat}&goalname=${name}`;
  return (
    `intent://route?${q}#Intent;scheme=tmap;package=${pkg};` +
    `category=android.intent.category.BROWSABLE;` +
    `category=android.intent.category.DEFAULT;` +
    `launchFlags=0x10000000;end`
  );
}

export function buildTmapBrowsableIntentUrlAny(dest: StaffFieldNaviDestination): string {
  const name = encodeURIComponent(dest.name || '현장');
  const q = `referrer=${TMAP_REFERRER}&goalx=${dest.lng}&goaly=${dest.lat}&goalname=${name}`;
  return (
    `intent://route?${q}#Intent;scheme=tmap;` +
    `category=android.intent.category.BROWSABLE;` +
    `category=android.intent.category.DEFAULT;` +
    `launchFlags=0x10000000;end`
  );
}

export function buildStaffFieldNaviIntentUrl(
  app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
  pkg?: string,
): string {
  if (app === 'kakaonavi') {
    const name = encodeURIComponent(dest.name || '현장');
    return (
      `intent://navigate?name=${name}&x=${dest.lng}&y=${dest.lat}&coord_type=wgs84` +
      `#Intent;scheme=kakaonavi;package=${KAKAO_NAVI_PKG};` +
      `category=android.intent.category.BROWSABLE;end`
    );
  }
  return buildTmapBrowsableIntentUrl(dest, pkg ?? TMAP_PKG);
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
  if (!isCbiseoStaffNativeApp()) {
    openWithoutNavigatingWebView(schemeUrlForStaffFieldNavi(app, dest));
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

  if (app === 'tmap') {
    /** 패키지 없는 BROWSABLE Intent가 깔린 TMAP을 찾음. 패키지 고정은 실패 시 스토어로 감 */
    callStaffBridgeOpenExternal(buildTmapBrowsableIntentUrlAny(dest));
    window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      callStaffBridgeOpenExternal(buildTmapBrowsableIntentUrl(dest, TMAP_PKG));
    }, 400);
    window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      callStaffBridgeOpenExternal(buildTmapBrowsableIntentUrl(dest, TMAP_PKG_LEGACY));
    }, 800);
    return;
  }

  callStaffBridgeOpenExternal(buildStaffFieldNaviIntentUrl('kakaonavi', dest));
}
