import { useEffect } from 'react';

const BODY_CLASS = 'team-mobile-bottom-nav-suppressed';

/** 팀장 모바일 하단 pill 네비 — 모달·시트가 열릴 때 가림·터치 충돌 방지 */
export function useSuppressTeamMobileBottomNav(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    document.body.classList.add(BODY_CLASS);
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, [active]);
}
