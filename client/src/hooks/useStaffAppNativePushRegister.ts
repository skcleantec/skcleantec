import { useEffect } from 'react';
import { isCbiseoStaffNativeApp, syncCbiseoStaffAuthToken } from '../utils/cbiseoNativeApp';

/** Android — WebView JWT를 TokenStore에 동기화 (FCM 네이티브 등록 전제) */
export function useStaffAppNativePushRegister(authToken: string | null | undefined): void {
  useEffect(() => {
    if (!authToken || !isCbiseoStaffNativeApp()) return;
    syncCbiseoStaffAuthToken(authToken);
  }, [authToken]);
}
