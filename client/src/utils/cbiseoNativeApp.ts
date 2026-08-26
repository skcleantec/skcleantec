/** Google Play 「청소비서」 업무 앱 WebView 브릿지 */
import {
  CBISEO_STAFF_APP_STORAGE_KEY,
  isStaffAppPcOnlyAdminPath,
} from '@shared/cbiseoStaffAppPolicy';
import { fetchStaffAppPushStatus, registerStaffAppFcmToken } from '../api/staffAppPush';

declare global {
  interface Window {
    CbiseoApp?: {
      isNativeApp: () => boolean;
      getPlatform: () => 'android';
      requestGoogleLogin?: () => void;
      syncAuthToken?: (jwt: string) => void;
      requestNotificationPermission?: () => void;
      registerPushToken?: () => void;
      getPushRegisterStatus?: () => string;
      getCachedFcmToken?: () => string;
      getAppVersionCode?: () => number;
      /** WebView 로그아웃 — 네이티브 FCM·TokenStore 정리 */
      notifyStaffLogout?: () => void;
    };
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

export function isPcOnlyPathInStaffApp(pathname: string): boolean {
  return isCbiseoStaffNativeApp() && isStaffAppPcOnlyAdminPath(pathname);
}

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

export function requestCbiseoStaffNotificationPermission(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CbiseoApp?.requestNotificationPermission?.();
  } catch {
    /* WebView 브릿지 미연결 */
  }
}

export function registerCbiseoStaffPushToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CbiseoApp?.registerPushToken?.();
  } catch {
    /* WebView 브릿지 미연결 */
  }
}

/** 로그아웃 직전 — 네이티브 TokenStore JWT로 FCM 해제 (웹 localStorage 비우기 전 호출) */
export function notifyCbiseoStaffLogout(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CbiseoApp?.notifyStaffLogout?.();
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
      return { ok: true, message: '서버 등록 완료' };
    } catch (e) {
      const webErr = e instanceof Error ? e.message : '웹 등록 실패';
      return { ok: false, message: status.message ? `${status.message} · ${webErr}` : webErr };
    }
  }
  return { ok: false, message: status.message ?? 'FCM 토큰을 받지 못했습니다' };
}

/** 로그인·홈 진입 시 자동 등록 (일반 앱과 동일 — 사용자 조작 불필요) */
export async function ensureCbiseoStaffPushRegistered(
  authToken: string,
  opts?: { skipIfRegistered?: boolean },
): Promise<{ ok: boolean; message?: string; skipped?: boolean }> {
  if (!isCbiseoStaffNativeApp()) return { ok: false, message: '업무 앱 WebView가 아닙니다' };
  syncCbiseoStaffAuthToken(authToken);
  if (opts?.skipIfRegistered !== false) {
    try {
      const status = await fetchStaffAppPushStatus(authToken);
      if (status.hasRegisteredToken) return { ok: true, skipped: true };
    } catch {
      /* status 실패 시 등록 시도 */
    }
  }
  requestCbiseoStaffNotificationPermission();
  const result = await registerCbiseoStaffPushWithPoll(authToken);
  return { ok: result.ok, message: result.message };
}

export const STAFF_APP_CRM_PC_MESSAGE =
  '텔레CRM은 PC에서만 이용할 수 있습니다. 사무실 PC 브라우저에서 청소비서 관리 화면 → 텔레CRM을 열어 주세요.';
