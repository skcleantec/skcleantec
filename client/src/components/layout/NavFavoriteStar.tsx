import { useCallback, useState } from 'react';
import { useNavFavorites } from '../../hooks/useNavFavorites';

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

type Props = {
  navKey: string;
  label: string;
  /** 다크 GNB·사이드 네비 */
  onDark?: boolean;
  compact?: boolean;
  className?: string;
};

export function NavFavoriteStar({ navKey, label, onDark = false, compact = false, className = '' }: Props) {
  const { ready, isFavorite, toggle, max } = useNavFavorites();
  const [hint, setHint] = useState<string | null>(null);

  const active = ready && isFavorite(navKey);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!ready) return;
      const result = toggle(navKey, label);
      if (!result.ok && result.reason === 'max') {
        setHint(`즐겨찾기는 최대 ${max}개까지 가능합니다.`);
        window.setTimeout(() => setHint(null), 2500);
        return;
      }
      if (result.ok) {
        setHint(result.added ? '즐겨찾기에 추가했습니다' : '즐겨찾기에서 제거했습니다');
        window.setTimeout(() => setHint(null), 1500);
      }
    },
    [ready, toggle, navKey, label, max],
  );

  const size = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnClass = [
    'inline-flex shrink-0 items-center justify-center rounded-md touch-manipulation transition-colors',
    compact ? 'min-h-8 min-w-8' : 'min-h-9 min-w-9',
    onDark
      ? active
        ? 'text-amber-300 hover:text-amber-200'
        : 'text-slate-500 hover:text-amber-300/90'
      : active
        ? 'text-amber-500 hover:text-amber-600'
        : 'text-slate-400 hover:text-amber-500',
    className,
  ].join(' ');

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={handleClick}
        className={btnClass}
        aria-pressed={active}
        aria-label={active ? `${label} 즐겨찾기 해제` : `${label} 즐겨찾기 추가`}
        title={active ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      >
        <StarIcon filled={active} className={size} />
      </button>
      {hint ? (
        <span
          role="status"
          className={[
            'pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-medium shadow-sm',
            onDark ? 'bg-slate-800 text-amber-100 ring-1 ring-white/10' : 'bg-slate-900 text-white',
          ].join(' ')}
        >
          {hint}
        </span>
      ) : null}
    </span>
  );
}
