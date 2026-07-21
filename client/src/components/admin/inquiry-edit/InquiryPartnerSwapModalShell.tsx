import type { ReactNode } from 'react';

/** 팀장·팀원 교차 변경 모달 — 모바일 컴팩트 / sm+ 기존 밀도 */
export const swapModalChipBtn =
  'min-h-[36px] touch-manipulation rounded-md border px-2 py-1.5 text-fluid-xs font-medium transition-colors sm:min-h-[44px] sm:rounded-lg sm:px-3 sm:py-2 sm:text-fluid-sm';

export const swapModalChipBtnOn =
  'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm';

export const swapModalChipBtnOff =
  'border-gray-200 bg-white text-gray-800 hover:bg-gray-100';

export const swapModalChipBtnPartnerOn =
  'border-indigo-600 bg-white text-indigo-900 shadow-sm ring-1 ring-indigo-300';

export const swapModalSelectBtn =
  'min-h-[36px] w-full touch-manipulation rounded-md border px-2 py-1.5 text-fluid-xs font-medium transition-colors sm:min-h-[44px] sm:w-auto sm:min-w-[8rem] sm:rounded-lg sm:px-3 sm:py-2 sm:text-fluid-sm';

type Props = {
  titleId: string;
  title: string;
  description: string;
  descriptionMobile?: string;
  onBackdropClose: () => void;
  backdropCloseDisabled?: boolean;
  footer: ReactNode;
  children: ReactNode;
};

export function InquiryPartnerSwapModalShell({
  titleId,
  title,
  description,
  descriptionMobile,
  onBackdropClose,
  backdropCloseDisabled,
  footer,
  children,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[570] flex flex-col justify-end bg-black/40 p-0 sm:flex-row sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="닫기"
        onClick={() => !backdropCloseDisabled && onBackdropClose()}
      />
      <div
        className="relative flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[min(90vh,40rem)] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 sm:px-5 sm:py-3">
          <h3 id={titleId} className="text-fluid-sm font-semibold text-gray-900 sm:text-base">
            {title}
          </h3>
          <p className="mt-0.5 text-[10px] leading-snug text-gray-600 sm:hidden">{descriptionMobile ?? description}</p>
          <p className="mt-1 hidden text-fluid-xs text-gray-600 sm:block">{description}</p>
        </div>
        <div className="max-h-[min(60vh,28rem)] min-h-[9rem] flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 sm:max-h-[min(65vh,28rem)] sm:min-h-[12rem] sm:px-5 sm:py-3">
          {children}
        </div>
        <div className="flex shrink-0 gap-1.5 border-t border-gray-100 px-3 py-2 sm:justify-end sm:gap-2 sm:px-5 sm:py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

export function SwapModalFooterButton({
  variant,
  disabled,
  onClick,
  children,
  className = '',
}: {
  variant: 'secondary' | 'primary';
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  const base =
    'min-h-[40px] flex-1 touch-manipulation rounded-lg px-3 py-2 text-fluid-xs disabled:opacity-50 sm:min-h-[44px] sm:flex-none sm:px-4 sm:text-fluid-sm';
  const variantClass =
    variant === 'primary'
      ? 'bg-indigo-600 font-medium text-white hover:bg-indigo-700 disabled:hover:bg-indigo-600'
      : 'border border-gray-300 text-gray-700 hover:bg-gray-50';
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${base} ${variantClass} ${className}`.trim()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
