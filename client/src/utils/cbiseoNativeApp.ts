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
      getAppVersionName?: () => string;
      getAppUpdateStatusJson?: () => string;
      refreshAppUpdateStatus?: () => void;
      startAppUpdate?: (mode: 'flexible' | 'immediate') => void;
      completeFlexibleAppUpdate?: () => void;
      openPlayStore?: () => void;
      /** http(s) 등 — 시스템 브라우저(외부)에서 열기 */
      openExternalUrl?: (url: string) => void;
      /** 글 공유 — 카카오톡 등을 고르는 창. 없는 구버전 앱은 호출하지 않는다. */
      shareText?: (title: string, text: string) => void;
      /** TMAP — Play v38+ 네이티브 Intent */
      openNavi?: (app: string, lat: string, lng: string, name: string) => void;
      /** WebView 로그아웃 — 네이티브 FCM·TokenStore 정리 */
      notifyStaffLogout?: () => void;
    };
    __cbiseoNativeGoogleLogin?: (idToken: string) => void;
    __cbiseoNativeGoogleLoginError?: (message: string) => void;
    /** true면 열린 창을 닫았으니 앱은 뒤로 가지 않는다. */
    __cbiseoHandleBack?: () => boolean;
    /** 겹쳐 연 모바일 CRM이 열려 있으면 닫고 true */
    __cbiseoMobileCrmBack?: () => boolean;
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

/** 앱 WebView — 배너·프로모 링크를 시스템 브라우저(외부)에서 연다 */
/** 업무 앱 공유 창. 브릿지가 없으면 false. */
export function shareTextInStaffApp(title: string, text: string): boolean {
  if (typeof window === 'undefined') return false;
  const share = window.CbiseoApp?.shareText;
  if (typeof share !== 'function') return false;
  const body = text.trim();
  if (!body) return false;
  try {
    share.call(window.CbiseoApp, title.trim(), body);
    return true;
  } catch {
    return false;
  }
}

function isOnScreen(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function clickClose(root: ParentNode): boolean {
  const labeled = root.querySelector<HTMLElement>('button[aria-label="닫기"], button[aria-label="메뉴 닫기"]');
  if (labeled && isOnScreen(labeled)) {
    labeled.click();
    return true;
  }
  const buttons = root.querySelectorAll('button');
  for (let i = buttons.length - 1; i >= 0; i -= 1) {
    const button = buttons[i];
    if (!button || !isOnScreen(button)) continue;
    if ((button.textContent ?? '').replace(/\s/g, '') === '닫기') {
      button.click();
      return true;
    }
  }
  return false;
}

/** 열린 팝업·메뉴를 먼저 닫는다. 앱 뒤로가기 직전에 호출된다. */
export function installCbiseoHardwareBack(): void {
  if (typeof window === 'undefined') return;
  window.__cbiseoHandleBack = () => {
    if (window.__cbiseoMobileCrmBack?.()) return true;
    const menuClose = document.querySelector<HTMLElement>('button[aria-label="메뉴 닫기"]');
    if (menuClose && isOnScreen(menuClose)) {
      menuClose.click();
      return true;
    }
    const sheet = document.querySelector('[data-fab-sheet]');
    if (sheet && isOnScreen(sheet)) {
      if (!clickClose(sheet)) sheet.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }
    const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(isOnScreen);
    const top = dialogs[dialogs.length - 1];
    if (!top) return false;
    if (clickClose(top)) return true;
    const overlay = top.parentElement;
    if (overlay && overlay !== document.body) {
      overlay.click();
      return true;
    }
    return true;
  };
}

export function openStaffAppExternalUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;
  if (isCbiseoStaffNativeApp()) {
    try {
      window.CbiseoApp?.openExternalUrl?.(trimmed);
    } catch {
      /* WebView 브릿지 미연결 */
    }
    return;
  }
  window.open(trimmed, '_blank', 'noopener,noreferrer');
}

export function getCbiseoStaffAppVersionCode(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.CbiseoApp?.getAppVersionCode?.();
    const code = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(code) ? code : null;
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
