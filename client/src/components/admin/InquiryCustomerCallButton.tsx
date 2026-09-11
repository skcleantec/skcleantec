import type { ReactNode } from 'react';
import { LineMdIcon } from '../ui/LineMdIcon';

type InquiryCustomerCallButtonProps = {
  phone: string | null | undefined;
  customerName?: string | null;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  /** icon=수화기만. 목록은 기본 텍스트 「전화」 */
  variant?: 'text' | 'icon';
  ariaLabel?: string;
};

/** 접수 목록·상세 — 모바일 전화(행 클릭·모달과 분리, tel: 고스트 클릭 방지) */
export function InquiryCustomerCallButton({
  phone,
  customerName,
  disabled = false,
  className = '',
  children = '전화',
  variant = 'text',
  ariaLabel,
}: InquiryCustomerCallButtonProps) {
  const tel = phone?.trim() ?? '';
  const digits = tel.replace(/\D/g, '');
  const canCall = !disabled && digits.length >= 8;
  const label =
    ariaLabel?.trim() ||
    (customerName?.trim() ? `${customerName.trim()}에게 전화` : '고객에게 전화');

  const dial = () => {
    if (!canCall) return;
    window.location.href = `tel:${tel}`;
  };

  return (
    <button
      type="button"
      disabled={!canCall}
      aria-label={label}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (canCall) e.preventDefault();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dial();
      }}
      className={`touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {variant === 'icon' ? <LineMdIcon name="phone" className="size-4" /> : children}
    </button>
  );
}
