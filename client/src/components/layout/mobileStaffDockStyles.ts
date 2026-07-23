/** 모바일(lg 미만) — 우측 FAB·GNB 톤 (기본 40px · 50%는 너무 작아 30px 중간값) */

export const MOBILE_STAFF_DOCK_BTN_PX = 30;
export const MOBILE_STAFF_DOCK_GAP_PX = 2;

export const MOBILE_STAFF_DOCK_BTN_CLASS =
  'relative flex h-[30px] w-[30px] shrink-0 touch-none items-center justify-center rounded-full transition-[transform,box-shadow,colors] active:scale-[0.94] touch-manipulation';

export const MOBILE_STAFF_DOCK_ICON_CLASS = 'h-3.5 w-3.5';

/** max-lg — 상단 GNB 메뉴 칩 (기본 대비 약 75%) */
export const MOBILE_GNB_ITEM_BASE =
  'inline-flex flex-row flex-nowrap items-center gap-1 px-2 py-1 text-fluid-xs font-semibold rounded-lg whitespace-nowrap shrink-0 touch-manipulation transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] lg:gap-1.5 lg:px-3 lg:py-1.5 lg:rounded-xl';

export const MOBILE_GNB_ICON_CLASS = 'h-3 w-3 shrink-0 lg:h-4 lg:w-4';

export const MOBILE_GNB_SCROLL_BTN_CLASS =
  'pointer-events-auto relative flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/30 bg-slate-700/95 text-white shadow-md shadow-black/25 transition-all hover:bg-slate-600 hover:border-white/40 active:scale-95 lg:h-9 lg:w-9';

export const MOBILE_GNB_SCROLL_ICON_CLASS = 'h-3 w-3 lg:h-4 lg:w-4';
