import { isCbiseoStaffNativeApp, openStaffAppExternalUrl } from './cbiseoNativeApp';

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
): string {
  if (app === 'kakaonavi') {
    const q = new URLSearchParams({
      name: dest.name,
      x: String(dest.lng),
      y: String(dest.lat),
      coord_type: 'wgs84',
    });
    return `intent://navigate?${q.toString()}#Intent;scheme=kakaonavi;package=${KAKAO_NAVI_PKG};end`;
  }
  const q = new URLSearchParams({
    goalx: String(dest.lng),
    goaly: String(dest.lat),
    goalname: dest.name,
  });
  return `intent://route?${q.toString()}#Intent;scheme=tmap;package=${TMAP_PKG};end`;
}

/** 설치 앱 선택 창 — 카카오내비·TMAP·지도가 geo를 받음. Chrome으로 앱을 죽이지 않음 */
export function buildGeoNaviUrl(dest: StaffFieldNaviDestination): string {
  const label = encodeURIComponent(dest.name || '현장');
  return `geo:${dest.lat},${dest.lng}?q=${dest.lat},${dest.lng}(${label})`;
}

export function storeUrlForStaffFieldNavi(app: StaffFieldNaviApp): string {
  return app === 'kakaonavi' ? KAKAO_NAVI_STORE : TMAP_STORE;
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

export function launchStaffFieldNavi(app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): void {
  const intentUrl = buildStaffFieldNaviIntentUrl(app, dest);
  const scheme = app === 'kakaonavi' ? buildKakaoNaviUrl(dest) : buildTmapNaviUrl(dest);
  const geo = buildGeoNaviUrl(dest);

  /** https 지도를 먼저 열면 청소비서 화면이 Chrome으로 넘어가 ‘꺼진 것처럼’ 보임 — 쓰지 않음 */
  openWithoutNavigatingWebView(intentUrl);
  window.setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    openWithoutNavigatingWebView(scheme);
  }, 350);
  window.setTimeout(() => {
    if (document.visibilityState !== 'visible') return;
    openWithoutNavigatingWebView(geo);
  }, 800);
}
