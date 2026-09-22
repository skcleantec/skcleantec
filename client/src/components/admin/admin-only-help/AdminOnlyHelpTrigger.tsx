import { LineMdIcon } from '../../ui/LineMdIcon';

type Props = {
  onClick: () => void;
  className?: string;
  label?: string;
};

/** 관리자 전용 화면 제목 옆 ? */
export function AdminOnlyHelpTrigger({ onClick, className = '', label = '이 화면 도움말' }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className}`.trim()}
    >
      <LineMdIcon name="question-circle" className="size-4" />
    </button>
  );
}
