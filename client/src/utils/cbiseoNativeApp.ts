/** Google Play 「청소비서」 업무 앱 WebView 브릿지 */
import {
  CBISEO_STAFF_APP_STORAGE_KEY,
  isStaffAppPcOnlyAdminPath,
} from '@shared/cbiseoStaffAppPolicy';

declare global {
  interface Window {
    CbiseoApp?: {
      isNativeApp: () => boolean;
      getPlatform: () => 'android';
      /** FCM 토큰을 서버 register API로 전달 (네이티브가 호출) */
      onFcmToken?: (token: string) => void;
    };
  }
}

export function isCbiseoStaffNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.CbiseoApp?.isNativeApp?.() === true) return true;
    return localStorage.getItem(CBISEO_STAFF_APP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 업무 앱에서 PC 전용 admin 경로인지 (CRM 등) */
export function isPcOnlyPathInStaffApp(pathname: string): boolean {
  return isCbiseoStaffNativeApp() && isStaffAppPcOnlyAdminPath(pathname);
}

export const STAFF_APP_CRM_PC_MESSAGE =
  '텔레CRM은 PC에서만 이용할 수 있습니다. 사무실 PC 브라우저에서 청소비서 관리 화면 → 텔레CRM을 열어 주세요.';
