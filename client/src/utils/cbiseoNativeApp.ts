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
      /** 앱 WebView — 네이티브 Google Sign-In (Phase 8) */
      requestGoogleLogin?: () => void;
      /** FCM 토큰을 서버 register API로 전달 (네이티브가 호출) */
      onFcmToken?: (token: string) => void;
      /** Android — 알림 권한 요청 + FCM 토큰 서버 등록 */
      requestNotificationPermission?: () => void;
      /** Android — FCM 토큰 서버 등록만 강제 재시도 */
      registerPushToken?: () => void;
    };
    /** Android 네이티브 Google 로그인 콜백 — LoginPage/GoogleSignupButton에서 등록 */
    __cbiseoNativeGoogleLogin?: (idToken: string) => void;
    __cbiseoNativeGoogleLoginError?: (message: string) => void;
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

/** Android 업무 앱 — 네이티브 알림 권한 팝업·FCM 등록 트리거 */
export function requestCbiseoStaffNotificationPermission(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CbiseoApp?.requestNotificationPermission?.();
  } catch {
    /* WebView 브릿지 미연결 */
  }
}

/** Android — FCM 토큰 서버 등록 강제 (홈·설정에서 호출) */
export function registerCbiseoStaffPushToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CbiseoApp?.registerPushToken?.();
  } catch {
    /* WebView 브릿지 미연결 */
  }
}

export const STAFF_APP_CRM_PC_MESSAGE =
  '텔레CRM은 PC에서만 이용할 수 있습니다. 사무실 PC 브라우저에서 청소비서 관리 화면 → 텔레CRM을 열어 주세요.';
