import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useIsLgUp } from '../../hooks/useMediaQuery';

const MOBILE_FLOATING_MENU_SIZE_PX = 40;

/** viewport fixed 햄버거·스케줄 FAB — 그 위 포털 모달은 최소 `z-[120]` */
export const Z_MOBILE_FLOATING_MENU = 118;
export const Z_ABOVE_MOBILE_FLOATING_MENU = 'z-[120]';

const MOBILE_MENU_BUTTON_SURFACE =
  'rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.12),0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-inset ring-white/80 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.94] touch-manipulation';

export type MobileFloatingMenuButtonProps = {
  onClick: () => void;
  'aria-label': string;
  title?: string;
  showBadgeDot?: boolean;
  badgeClassName?: string;
  children: ReactNode;
  /** lg 미만에서만 표시 */
  className?: string;
};

export type MobileInlineMenuButtonProps = Omit<MobileFloatingMenuButtonProps, 'className'> & {
  className?: string;
};

/** 페이지 제목 줄 등 — fixed 없이 제목 왼쪽에 붙는 햄버거·메뉴 버튼 */
export function MobileInlineMenuButton({
  onClick,
  'aria-label': ariaLabel,
  title,
  showBadgeDot = false,
  badgeClassName = 'bg-red-600',
  children,
  className = '',
}: MobileInlineMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={[
        'relative flex lg:hidden h-9 w-9 shrink-0 items-center justify-center',
        MOBILE_MENU_BUTTON_SURFACE,
        className,
      ].join(' ')}
    >
      {children}
      {showBadgeDot ? (
        <span
          className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-1 ring-white ${badgeClassName}`}
          aria-hidden
        />
      ) : null}
    </button>
  );
}

/**
 * 모바일 햄버거 등 — viewport 기준 fixed 플로팅 (발주서·스케줄 FAB와 동일하게 스크롤해도 유지).
 */
export function MobileFloatingMenuButton({
  onClick,
  'aria-label': ariaLabel,
  title,
  showBadgeDot = false,
  badgeClassName = 'bg-red-600',
  children,
  className = '',
}: MobileFloatingMenuButtonProps) {
  const isLgUp = useIsLgUp();
  if (typeof document === 'undefined' || isLgUp) return null;

  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={[
        'fixed z-[118] flex lg:hidden shrink-0 items-center justify-center',
        MOBILE_MENU_BUTTON_SURFACE,
        className,
      ].join(' ')}
      style={{
        display: 'flex',
        width: MOBILE_FLOATING_MENU_SIZE_PX,
        height: MOBILE_FLOATING_MENU_SIZE_PX,
        top: 'max(5.5rem, calc(env(safe-area-inset-top, 0px) + 4.25rem))',
        left: 'max(12px, env(safe-area-inset-left, 0px))',
      }}
    >
      {children}
      {showBadgeDot ? (
        <span
          className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-1 ring-white ${badgeClassName}`}
          aria-hidden
        />
      ) : null}
    </button>,
    document.body,
  );
}
