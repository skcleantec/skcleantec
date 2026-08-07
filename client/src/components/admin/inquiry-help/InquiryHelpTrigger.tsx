type Props = {
  onClick: () => void;
  className?: string;
};

/** 서비스접수 제목 옆 ? — 도움말 모달 열기 */
export function InquiryHelpTrigger({ onClick, className }: Props) {
  return (
    <button
      type="button"
      aria-label="서비스접수 도움말"
      title="서비스접수 도움말"
      onClick={onClick}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${className ?? ''}`}
    >
      ?
    </button>
  );
}
