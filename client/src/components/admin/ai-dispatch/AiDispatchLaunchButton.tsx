import type { ReactNode } from 'react';
import { AiWordmarkButton } from '../../ui/AiWordmarkButton';

export function AiDispatchLaunchButton({
  children,
  onClick,
  disabled,
  size = 'default',
  mark = false,
  tone = 'light',
  ariaLabel,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** compact·row는 스케줄 「AI 빠른등록」과 같은 가로 크기 */
  size?: 'default' | 'compact' | 'row';
  /** Ai 글자를 앞에 붙인다. 스케줄의 AI팀장배정 */
  mark?: boolean;
  tone?: 'light' | 'dark';
  ariaLabel?: string;
  className?: string;
}) {
  const labelText = typeof children === 'string' ? children : 'AI팀장배정';
  return (
    <AiWordmarkButton
      label={children}
      ariaLabel={ariaLabel ?? (mark ? 'AI팀장배정' : labelText)}
      onClick={onClick}
      disabled={disabled}
      size={size}
      mark={mark}
      tone={tone}
      className={className}
    />
  );
}
