/** PC 우측 고정 독 — GNB(theme-dark-header)와 동일 톤 */

export const STAFF_DESKTOP_DOCK_BTN_PX = 40;
export const STAFF_DESKTOP_DOCK_GAP_PX = 0;
export const STAFF_DESKTOP_DOCK_STORAGE_KEY = 'staffDesktopRightDockTop_v1';

export function staffDesktopDockShellClass(dragging?: boolean) {
  return [
    'theme-dark-header fixed z-30 hidden lg:flex flex-col items-stretch rounded-l-xl border border-r-0 border-[#1e293b] bg-[#0f172a] shadow-[-4px_0_16px_rgba(15,23,42,0.35)] overflow-hidden',
    dragging ? 'touch-none cursor-grabbing ring-2 ring-blue-500/40' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function staffDesktopDockButtonClass(active: boolean, opts?: { pulse?: boolean; dragging?: boolean }) {
  const base =
    'relative flex h-10 w-10 shrink-0 touch-none items-center justify-center border-0 transition-[transform,colors,background-color] active:scale-[0.94] cursor-pointer';
  const tone = active
    ? 'bg-blue-600 text-white hover:bg-blue-500'
    : 'bg-[#0f172a] text-slate-200 hover:bg-white/10 hover:text-white';
  const motion = opts?.dragging ? 'scale-[1.02]' : '';
  const pulse = opts?.pulse ? 'animate-pulse' : '';
  return [base, tone, motion, pulse].filter(Boolean).join(' ');
}

export function staffDesktopDockDividerClass() {
  return 'h-px w-full shrink-0 bg-white/10';
}

export type StaffDesktopDockDragHandlers = {
  dragging: boolean;
  onPointerDown: (evt: React.PointerEvent<HTMLButtonElement>) => void;
};
