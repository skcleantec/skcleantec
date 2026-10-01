import type { ReactNode } from 'react';
import { LineMdIcon } from '../../ui/LineMdIcon';

export function AiDispatchLaunchButton({
  children,
  onClick,
  disabled,
  size = 'default',
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** compact·row는 스케줄 「AI 빠른등록」과 같은 높이·글자·여백 */
  size?: 'default' | 'compact' | 'row';
  className?: string;
}) {
  const sizeClass =
    size === 'compact'
      ? 'h-auto w-auto shrink-0 gap-1.5 rounded-lg px-3 py-2 text-fluid-xs whitespace-nowrap'
      : size === 'row'
        ? 'min-h-9 min-w-0 flex-1 gap-1 rounded-md px-1.5 py-1 text-fluid-2xs'
        : 'min-h-10 gap-1.5 rounded-lg px-3 text-fluid-xs';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`crm-ai-shimmer crm-ai-glow-ring inline-flex items-center justify-center font-semibold text-white touch-manipulation hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] ${sizeClass} ${className}`}
    >
      <LineMdIcon name="star-pulsating-loop" className={size === 'default' ? 'size-4 shrink-0' : 'size-3 shrink-0'} />
      <span className="truncate">{children}</span>
    </button>
  );
}
