import { LineMdIcon } from '../../ui/LineMdIcon';

type Props = {
  onClick: () => void;
  className?: string;
  label?: string;
  /** 페이지 제목·별과 같은 줄 */
  compact?: boolean;
};

/** 관리자 전용 화면 제목 옆 ? */
export function AdminOnlyHelpTrigger({
  onClick,
  className = '',
  label = '이 화면 도움말',
  compact = false,
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-md text-slate-500',
        'hover:bg-slate-100 hover:text-slate-800',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        compact ? 'min-h-7 min-w-7' : 'min-h-9 min-w-9',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <LineMdIcon name="question-circle" className={compact ? 'size-3.5' : 'size-4'} />
    </button>
  );
}
