/** 모바일(lg 미만) — 우측 FAB·GNB 톤 (터치 최소 ~44px) */

export const MOBILE_STAFF_DOCK_BTN_PX = 44;
export const MOBILE_STAFF_DOCK_GAP_PX = 4;

/** glass FAB 공통 — `index.css` `.staff-mobile-fab-glass*` */
export const STAFF_MOBILE_FAB_GLASS_BASE = 'staff-mobile-fab-glass';

export const MOBILE_STAFF_DOCK_BTN_CLASS = `relative flex h-[44px] w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-full ${STAFF_MOBILE_FAB_GLASS_BASE} transition-[transform,box-shadow,background] active:scale-[0.94]`;

export const MOBILE_STAFF_DOCK_ICON_CLASS = 'relative z-[1] h-5 w-5';

/** FAB·하단 네비 알림 배지 — 원형 버튼 밖 우상단 (glass overflow에 잘리지 않음) */
export const STAFF_MOBILE_FAB_BADGE_CLASS =
  'pointer-events-none absolute -right-1 -top-1 z-[2] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums';

export const TEAM_MOBILE_BOTTOM_NAV_BADGE_CLASS = `${STAFF_MOBILE_FAB_BADGE_CLASS} bg-amber-400 text-slate-950 ring-1 ring-slate-900/15`;
export const STAFF_MOBILE_FAB_GLASS_VIOLET = 'staff-mobile-fab-glass-violet';
export const STAFF_MOBILE_FAB_GLASS_AMBER = 'staff-mobile-fab-glass-amber';
export const STAFF_MOBILE_FAB_GLASS_BLUE = 'staff-mobile-fab-glass-blue';
export const STAFF_MOBILE_FAB_GLASS_EMERALD = 'staff-mobile-fab-glass-emerald';
export const STAFF_MOBILE_FAB_GLASS_WHITE_EMERALD = 'staff-mobile-fab-glass-white-emerald';
export const STAFF_MOBILE_FAB_GLASS_SLATE = 'staff-mobile-fab-glass-slate';

/** max-lg — 상단 GNB 메뉴 칩 (기본 대비 약 75%) */
export const MOBILE_GNB_ITEM_BASE =
  'inline-flex flex-row flex-nowrap items-center gap-1 px-2 py-1 text-fluid-xs font-semibold rounded-lg whitespace-nowrap shrink-0 touch-manipulation transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] lg:gap-1.5 lg:px-3 lg:py-1.5 lg:rounded-xl';

export const MOBILE_GNB_ICON_CLASS = 'h-3 w-3 shrink-0 lg:h-4 lg:w-4';

export const MOBILE_GNB_SCROLL_BTN_CLASS =
  'pointer-events-auto relative flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/30 bg-slate-700/95 text-white shadow-md shadow-black/25 transition-all hover:bg-slate-600 hover:border-white/40 active:scale-95 lg:h-9 lg:w-9';

export const MOBILE_GNB_SCROLL_ICON_CLASS = 'h-3 w-3 lg:h-4 lg:w-4';

/** 팀장 모바일 하단 pill 네비 — FAB clamp·main pb 공통 (Galaxy safe-area 포함) */
export const TEAM_MOBILE_BOTTOM_NAV_RESERVE_PX = 72;
