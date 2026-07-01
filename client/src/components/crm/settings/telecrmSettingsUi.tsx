export function TelecrmReorderButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex gap-0.5 shrink-0">
      <button
        type="button"
        disabled={disabled || !canMoveUp}
        onClick={onMoveUp}
        className="px-1.5 py-0.5 text-[11px] border border-gray-300 rounded text-gray-600 disabled:opacity-30"
        title="위로"
        aria-label="순서 위로"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={disabled || !canMoveDown}
        onClick={onMoveDown}
        className="px-1.5 py-0.5 text-[11px] border border-gray-300 rounded text-gray-600 disabled:opacity-30"
        title="아래로"
        aria-label="순서 아래로"
      >
        ↓
      </button>
    </span>
  );
}

function parsePriceInt(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export { parsePriceInt };

export function formatWon(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}
