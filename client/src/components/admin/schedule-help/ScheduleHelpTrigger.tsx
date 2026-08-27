type Props = {
  onClick: () => void;
  className?: string;
};

/** 스케줄 제목 옆 ? — 도움말 모달 열기 */
export function ScheduleHelpTrigger({ onClick, className }: Props) {
  return (
    <button
      type="button"
      aria-label="스케줄 도움말"
      title="스케줄 도움말"
      onClick={onClick}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[12px] font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${className ?? ''}`}
    >
      ?
    </button>
  );
}
