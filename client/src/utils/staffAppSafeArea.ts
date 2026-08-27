/** Play 청소비서 WebView — 하단 시스템 내비게이션 바 여백 (Galaxy 등 env=0 대비) */

/** fixed 풀스크린 오버레이·하단 시트 래퍼 */
export const STAFF_APP_SAFE_OVERLAY =
  'cbiseo-staff-safe-overlay modal-mobile-safe-overlay';

/** padding-bottom (폼·푸터) */
export const STAFF_APP_SAFE_PB =
  'pb-[max(0.75rem,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))]';

/** overlay 바깥 padding (하단 시트) */
export const STAFF_APP_SAFE_OVERLAY_PAD =
  'p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px),var(--cbiseo-safe-area-bottom,0px))] sm:items-center';

/** 팀장 모바일 — main 스크롤 컨테이너 scroll-padding (하단 네비 위까지 스크롤) */
export const TEAM_MOBILE_BOTTOM_NAV_MAIN_SCROLL_PB =
  'max-lg:scroll-pb-[var(--team-mobile-bottom-nav-offset)]';

/** @deprecated padding-only — Outlet 뒤 spacer(`TEAM_MOBILE_BOTTOM_NAV_SCROLL_SPACER`) 사용 */
export const TEAM_MOBILE_BOTTOM_NAV_MAIN_PB = 'max-lg:pb-[var(--team-mobile-bottom-nav-offset)]';

/** 팀장 모바일 — Outlet 하단 spacer (`index.css` .team-mobile-bottom-nav-scroll-spacer) */
export const TEAM_MOBILE_BOTTOM_NAV_SCROLL_SPACER = 'team-mobile-bottom-nav-scroll-spacer';

/** 팀장 모바일 — 중첩 스크롤 영역(목록·폼) 하단 여백 */
export const TEAM_MOBILE_BOTTOM_NAV_SCROLL_PB = 'max-lg:pb-[var(--team-mobile-bottom-nav-offset)]';

/** z-[48] — 본문 위, 팀 모달·시트(z-[85]+) 아래 (터치 가로채기 방지) */
export const TEAM_MOBILE_BOTTOM_NAV_Z = 'z-[48]';
