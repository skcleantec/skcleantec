type Props = {
  onClick: () => void;
  /** 기본: 닫기 */
  'aria-label'?: string;
  className?: string;
  disabled?: boolean;
};

/** 모달 카드(부모에 `relative`) 오른쪽 상단 — 동그라미 안 X */
export function ModalCloseButton({
  onClick,
  'aria-label': ariaLabel = '닫기',
  className = '',
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-4 w-4 pointer-events-none"
        aria-hidden
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
