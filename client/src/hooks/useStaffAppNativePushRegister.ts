import { useEffect } from 'react';
import { registerStaffAppFcmToken } from '../api/staffAppPush';
import { isCbiseoStaffNativeApp, subscribeCbiseoFcmToken } from '../utils/cbiseoNativeApp';

/** Android — 네이티브 FCM 토큰 → WebView fetch로 /api/push/staff-app/register */
export function useStaffAppNativePushRegister(authToken: string | null | undefined): void {
  useEffect(() => {
    if (!authToken || !isCbiseoStaffNativeApp()) return;
    return subscribeCbiseoFcmToken(async ({ token, deviceLabel }) => {
      try {
        await registerStaffAppFcmToken(token, authToken, { deviceLabel });
        window.dispatchEvent(
          new CustomEvent('cbiseo:push-register', {
            detail: { ok: true, message: '서버 등록 완료' },
          }),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : '서버 등록 실패';
        window.dispatchEvent(
          new CustomEvent('cbiseo:push-register', {
            detail: { ok: false, message },
          }),
        );
      }
    });
  }, [authToken]);
}
