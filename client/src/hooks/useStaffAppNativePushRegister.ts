import { useEffect } from 'react';
import {
  ensureCbiseoStaffPushRegistered,
  isCbiseoStaffNativeApp,
  syncCbiseoStaffAuthToken,
} from '../utils/cbiseoNativeApp';

const AUTO_REGISTER_DELAY_MS = 800;
const AUTO_REGISTER_RETRY_MS = 8_000;

/**
 * Android — 로그인 후 FCM 서버 등록 자동 (폴링 + 웹 POST 백업).
 * 일반 앱처럼 사용자가 「서버 등록」 버튼을 누를 필요 없음.
 */
export function useStaffAppNativePushRegister(authToken: string | null | undefined): void {
  useEffect(() => {
    if (!authToken || !isCbiseoStaffNativeApp()) return;

    let cancelled = false;

    const run = async (attempt: number) => {
      syncCbiseoStaffAuthToken(authToken);
      if (attempt === 0) {
        await new Promise((r) => window.setTimeout(r, AUTO_REGISTER_DELAY_MS));
      }
      if (cancelled) return;

      const result = await ensureCbiseoStaffPushRegistered(authToken);
      if (cancelled || result.ok) return;

      if (attempt === 0) {
        window.setTimeout(() => {
          if (!cancelled) void run(1);
        }, AUTO_REGISTER_RETRY_MS);
      }
    };

    void run(0);
    return () => {
      cancelled = true;
    };
  }, [authToken]);
}
