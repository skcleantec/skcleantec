import { isCbiseoStaffNativeApp, openStaffAppExternalUrl } from './cbiseoNativeApp';

export type StaffFieldNaviApp = 'kakaonavi' | 'tmap';

export type StaffFieldNaviDestination = {
  lat: number;
  lng: number;
  name: string;
  /** SK Open API 공식 TMAP 앱 URL (`/tmap/app/routes`) */
  tmapAppRoutesUrl?: string | null;
};

const KAKAO_NAVI_PKG = 'com.locnall.KimGiSa';
const TMAP_PKG = 'com.skt.tmap.ku';
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

export function buildKakaoNaviUrl(dest: StaffFieldNaviDestination): string {
  const name = encodeURIComponent(dest.name || '현장');
  return `kakaonavi://navigate?name=${name}&x=${dest.lng}&y=${dest.lat}&coord_type=wgs84`;
}

/** Android TMAP — https://hanarotg.tistory.com/365 와 동일 */
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

/**
 * TMAP: SK Open API 공식 HTTPS (`tmap/app/routes`)를 앱 밖으로 연다.
 * Play 38 `openExternalUrl(https)` 가 이미 있음. `tmap://` href는 공식 문서에 없음.
 * https://openapi.sk.com/qnaCommunity/398
 */
export function launchStaffFieldNavi(app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): void {
  if (app === 'tmap') {
    const official = dest.tmapAppRoutesUrl?.trim();
    if (official) {
      openStaffAppExternalUrl(official);
      return;
    }
    try {
      window.CbiseoApp?.openNavi?.('tmap', String(dest.lat), String(dest.lng), dest.name);
      return;
    } catch {
      /* 브릿지 없음 */
    }
    openStaffAppExternalUrl(storeUrlForStaffFieldNavi('tmap'));
    return;
  }

  try {
    window.CbiseoApp?.openNavi?.('kakaonavi', String(dest.lat), String(dest.lng), dest.name);
    return;
  } catch {
    /* 브릿지 없음 */
  }
  if (!isCbiseoStaffNativeApp()) {
    openWithoutNavigatingWebView(schemeUrlForStaffFieldNavi('kakaonavi', dest));
  }
}
