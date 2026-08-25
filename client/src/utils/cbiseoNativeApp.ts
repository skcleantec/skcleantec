/** Google Play 「청소비서」 업무 앱 WebView 브릿지 */
import {
  CBISEO_STAFF_APP_STORAGE_KEY,
  isStaffAppPcOnlyAdminPath,
} from '@shared/cbiseoStaffAppPolicy';
import { registerStaffAppFcmToken } from '../api/staffAppPush';

declare global {
  interface Window {
    CbiseoApp?: {
      isNativeApp: () => boolean;
      getPlatform: () => 'android';
      /** 앱 WebView — 네이티브 Google Sign-In (Phase 8) */
      requestGoogleLogin?: () => void;
      /** WebView JWT → TokenStore 동기화 (FCM 서버 등록) */
      syncAuthToken?: (jwt: string) => void;
      /** Android — 알림 권한 요청 + FCM 토큰 서버 등록 */
      requestNotificationPermission?: () => void;
      /** Android — FCM 토큰 서버 등록만 강제 재시도 (네이티브 오케스트레이터) */
      registerPushToken?: () => void;
      /** Android — 네이티브 FCM 등록 상태 JSON (폴링) */
      getPushRegisterStatus?: () => string;
      /** Android — onNewToken·prefetch 캐시 FCM 토큰 (웹 POST 백업) */
      getCachedFcmToken?: () => string;
      /** Android — versionCode (Play 내부 테스트 빌드 확인) */
      getAppVersionCode?: () => number;
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

/** Android — WebView JWT를 TokenStore에 동기화 (로그인·레이아웃 마운트 시) */
export function syncCbiseoStaffAuthToken(jwt: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = jwt.trim();
  if (!trimmed) return;
  try {
    window.CbiseoApp?.syncAuthToken?.(trimmed);
  } catch {
    /* WebView 브릿지 미연결 */
  }
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

export function getCbiseoStaffAppVersionCode(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const code = window.CbiseoApp?.getAppVersionCode?.();
    return typeof code === 'number' && Number.isFinite(code) ? code : null;
  } catch {
    return null;
  }
}

export type CbiseoPushRegisterDetail = {
  pending?: boolean;
  ok?: boolean;
  message?: string;
  fcmToken?: string | null;
  updatedAtMs?: number;
};

function parsePushRegisterStatus(raw: string | undefined): CbiseoPushRegisterDetail | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as CbiseoPushRegisterDetail;
  } catch {
    return null;
  }
}

/** Android — 네이티브 FCM 등록 상태 폴링 (CustomEvent 대신 브릿지) */
export async function pollCbiseoPushRegisterStatus(
  timeoutMs = 25_000,
  intervalMs = 400,
): Promise<CbiseoPushRegisterDetail> {
  if (typeof window === 'undefined') {
    return { ok: false, message: '브라우저 환경이 아닙니다' };
  }
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const parsed = parsePushRegisterStatus(window.CbiseoApp?.getPushRegisterStatus?.());
    if (parsed && !parsed.pending) return parsed;
    await new Promise((r) => window.setTimeout(r, intervalMs));
  }
  return { ok: false, message: '등록 응답 시간 초과 — Google Play 서비스·앱 업데이트 확인' };
}

function readCachedFcmTokenFromBridge(): string | null {
  try {
    const token = window.CbiseoApp?.getCachedFcmToken?.()?.trim();
    return token && token.length >= 20 ? token : null;
  } catch {
    return null;
  }
}

/** 네이티브 등록 + 폴링 + 웹 POST 백업 */
export async function registerCbiseoStaffPushWithPoll(
  authToken: string,
): Promise<{ ok: boolean; message: string }> {
  if (!isCbiseoStaffNativeApp()) {
    return { ok: false, message: '업무 앱 WebView가 아닙니다' };
  }
  syncCbiseoStaffAuthToken(authToken);
  registerCbiseoStaffPushToken();
  const status = await pollCbiseoPushRegisterStatus();
  if (status.ok) {
    return { ok: true, message: status.message ?? '서버 등록 완료' };
  }
  const fcmToken = status.fcmToken?.trim() || readCachedFcmTokenFromBridge();
  if (fcmToken) {
    try {
      await registerStaffAppFcmToken(fcmToken, authToken, {
        deviceLabel: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : undefined,
      });
      return { ok: true, message: '서버 등록 완료 (웹)' };
    } catch (e) {
      const webErr = e instanceof Error ? e.message : '웹 등록 실패';
      return { ok: false, message: status.message ? `${status.message} · ${webErr}` : webErr };
    }
  }
  return { ok: false, message: status.message ?? 'FCM 토큰을 받지 못했습니다' };
}

export const STAFF_APP_CRM_PC_MESSAGE =
  '텔레CRM은 PC에서만 이용할 수 있습니다. 사무실 PC 브라우저에서 청소비서 관리 화면 → 텔레CRM을 열어 주세요.';
