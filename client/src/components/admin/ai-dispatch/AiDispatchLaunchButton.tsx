import type { ReactNode } from 'react';
import { LineMdIcon } from '../../ui/LineMdIcon';

export function AiDispatchLaunchButton({
  children,
  onClick,
  disabled,
  compact,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`crm-ai-shimmer crm-ai-glow-ring inline-flex items-center gap-1.5 rounded-lg font-semibold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        compact ? 'min-h-9 shrink-0 px-2 py-1 text-fluid-2xs' : 'min-h-10 px-3 text-fluid-xs'
      }`}
    >
      <LineMdIcon name="star-pulsating-loop" className={compact ? 'size-3.5' : 'size-4'} />
      {children}
    </button>
  );
}
