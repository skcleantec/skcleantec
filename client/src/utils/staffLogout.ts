import { unregisterStaffAppFcmToken } from '../api/staffAppPush';
import { clearToken, getToken } from '../stores/auth';
import { clearTeamToken, getTeamToken } from '../stores/teamAuth';
import { isCbiseoStaffNativeApp, notifyCbiseoStaffLogout } from './cbiseoNativeApp';

function resolveStaffAuthTokenForLogout(): string | null {
  return getTeamToken() ?? getToken();
}

function readCachedFcmTokenForLogout(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const token = window.CbiseoApp?.getCachedFcmToken?.()?.trim();
    return token && token.length >= 20 ? token : undefined;
  } catch {
    return undefined;
  }
}

/** 로그아웃·세션 만료 시 FCM 서버 등록 해제 후 로컬 JWT 비우기 */
export async function performStaffLogout(): Promise<void> {
  const authToken = resolveStaffAuthTokenForLogout();
  if (authToken) {
    if (isCbiseoStaffNativeApp()) {
      notifyCbiseoStaffLogout();
    }
    try {
      await unregisterStaffAppFcmToken(authToken, readCachedFcmTokenForLogout());
    } catch {
      /* 네트워크·만료 JWT — 로컬 세션은 반드시 비움 */
    }
  }
  clearTeamToken();
  clearToken();
}
