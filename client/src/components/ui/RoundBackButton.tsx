function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function RoundBackButton({
  onClick,
  ariaLabel = '이전',
  disabled,
  className = '',
}: {
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-800 shadow-sm touch-manipulation hover:bg-gray-50 active:scale-[0.97] disabled:opacity-50 ${className}`}
    >
      <ChevronLeftIcon className="h-4 w-4" />
    </button>
  );
}
