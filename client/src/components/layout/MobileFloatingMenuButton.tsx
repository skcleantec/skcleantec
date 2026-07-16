import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useIsLgUp } from '../../hooks/useMediaQuery';

const MOBILE_FLOATING_MENU_SIZE_PX = 40;

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
        'rounded-full border border-slate-200 bg-white text-slate-600',
        'shadow-[0_4px_14px_rgba(15,23,42,0.12),0_1px_4px_rgba(15,23,42,0.08)]',
        'ring-1 ring-inset ring-white/80',
        'hover:bg-slate-50 hover:text-slate-900 active:scale-[0.94] touch-manipulation',
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
