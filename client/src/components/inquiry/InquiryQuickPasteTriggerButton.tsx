import type { ReactNode } from 'react';
import { AiWordmarkButton } from '../ui/AiWordmarkButton';

/** PC·모바일 공통 — AI 빠른등록. 가로 Ai 글자 버튼 */
export function InquiryQuickPasteTriggerButton({
  onClick,
  className = '',
  size = 'default',
}: {
  onClick: () => void;
  className?: string;
  size?: 'default' | 'compact' | 'row' | 'responsive-compact';
}) {
  const label: ReactNode =
    size === 'responsive-compact' ? (
      <>
        <span className="hidden sm:inline">빠른</span>등록
      </>
    ) : (
      '빠른등록'
    );
  return (
    <AiWordmarkButton
      label={label}
      ariaLabel="AI 빠른등록"
      onClick={onClick}
      size={size}
      className={className}
    />
  );
}
