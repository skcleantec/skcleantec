import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isCbiseoStaffNativeApp } from '../utils/cbiseoNativeApp';

/** Android FCM 탭·포그라운드 `cbiseo:navigate` → React Router 이동 */
export function useStaffAppPushNavigation(enabled = true): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled || !isCbiseoStaffNativeApp()) return;

    const handler = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path?.trim();
      if (!path || !path.startsWith('/')) return;
      navigate(path);
    };

    window.addEventListener('cbiseo:navigate', handler);
    return () => window.removeEventListener('cbiseo:navigate', handler);
  }, [enabled, navigate]);
}
