/** 청소 전 사진 — 오염 심함 ⭐ 토글 (한 번 탭) */
export function InspectionPhotoFlagButton({
  flagged,
  disabled,
  onToggle,
  variant = 'light',
  className = '',
}: {
  flagged: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** light: 밝은 배경 · dark: 촬영 오버레이 */
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const base =
    variant === 'dark'
      ? flagged
        ? 'border-amber-300 bg-amber-500 text-white shadow-md shadow-amber-900/40'
        : 'border-white/40 bg-black/50 text-white/90'
      : flagged
        ? 'border-amber-400 bg-amber-400 text-white shadow'
        : 'border-gray-300 bg-white/95 text-gray-500';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      title={flagged ? '오염 심함 표시 해제' : '오염 심함으로 표시'}
      aria-label={flagged ? '오염 심함 표시 해제' : '오염 심함으로 표시'}
      aria-pressed={flagged}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base leading-none touch-manipulation active:scale-95 disabled:opacity-45 ${base} ${className}`}
    >
      {flagged ? '★' : '☆'}
    </button>
  );
}
