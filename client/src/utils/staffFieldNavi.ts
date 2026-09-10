import { isCbiseoStaffNativeApp, openStaffAppExternalUrl } from './cbiseoNativeApp';

export type StaffFieldNaviApp = 'tmap';

export type StaffFieldNaviDestination = {
  lat: number;
  lng: number;
  name: string;
  /** SK Open API 공식 TMAP 앱 URL (`/tmap/app/routes`) */
  tmapAppRoutesUrl?: string | null;
};

const TMAP_PKG = 'com.skt.tmap.ku';
const TMAP_STORE = `https://play.google.com/store/apps/details?id=${TMAP_PKG}`;
/** TMAP 지원이 Android 연동에 안내한 referrer */
const TMAP_REFERRER = 'com.skt.Tmap';

export function canLaunchStaffFieldNavi(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCbiseoStaffNativeApp()) return true;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Android TMAP — https://hanarotg.tistory.com/365 과 동일 (`referrer=com.skt.Tmap`) */
export function buildTmapNaviUrl(dest: StaffFieldNaviDestination): string {
  const name = encodeURIComponent(dest.name || '현장');
  return `tmap://route?referrer=${TMAP_REFERRER}&goalx=${dest.lng}&goaly=${dest.lat}&goalname=${name}`;
}

export function schemeUrlForStaffFieldNavi(
  _app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
): string {
  return buildTmapNaviUrl(dest);
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
  _app: StaffFieldNaviApp,
  dest: StaffFieldNaviDestination,
  pkg?: string,
): string {
  return buildTmapBrowsableIntentUrl(dest, pkg ?? TMAP_PKG);
}

export function buildGeoNaviUrl(dest: StaffFieldNaviDestination): string {
  const label = encodeURIComponent(dest.name || '현장');
  return `geo:${dest.lat},${dest.lng}?q=${dest.lat},${dest.lng}(${label})`;
}

export function storeUrlForStaffFieldNavi(_app: StaffFieldNaviApp = 'tmap'): string {
  return TMAP_STORE;
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

export function httpsUrlForStaffFieldNavi(_app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): string {
  return buildTmapHttpsUrl(dest);
}

/**
 * TMAP만. SK Open API 공식 HTTPS (`tmap/app/routes`)를 앱 밖으로 연다.
 * https://openapi.sk.com/qnaCommunity/398
 */
export function launchStaffFieldNavi(dest: StaffFieldNaviDestination): void {
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
  openStaffAppExternalUrl(TMAP_STORE);
}
