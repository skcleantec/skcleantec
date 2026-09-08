import { isCbiseoStaffNativeApp, openStaffAppExternalUrl } from './cbiseoNativeApp';

export type StaffFieldNaviApp = 'kakaonavi' | 'tmap';

export type StaffFieldNaviDestination = {
  lat: number;
  lng: number;
  name: string;
};

const KAKAO_NAVI_STORE = 'https://play.google.com/store/apps/details?id=com.locnall.KimGiSa';
const TMAP_STORE = 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';

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

export function storeUrlForStaffFieldNavi(app: StaffFieldNaviApp): string {
  return app === 'kakaonavi' ? KAKAO_NAVI_STORE : TMAP_STORE;
}

export function launchStaffFieldNavi(app: StaffFieldNaviApp, dest: StaffFieldNaviDestination): void {
  const scheme = app === 'kakaonavi' ? buildKakaoNaviUrl(dest) : buildTmapNaviUrl(dest);
  const store = storeUrlForStaffFieldNavi(app);
  if (isCbiseoStaffNativeApp()) {
    openStaffAppExternalUrl(scheme);
    return;
  }
  const started = Date.now();
  window.location.href = scheme;
  window.setTimeout(() => {
    if (Date.now() - started < 2500 && document.visibilityState === 'visible') {
      window.location.href = store;
    }
  }, 1200);
}
