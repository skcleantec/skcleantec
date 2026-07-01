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

export function TelecrmCatalogScopeSegment({
  value,
  onChange,
  showShared,
  showPersonal = true,
}: {
  value: 'shared' | 'personal';
  onChange: (v: 'shared' | 'personal') => void;
  showShared?: boolean;
  showPersonal?: boolean;
}) {
  if (!showPersonal && !showShared) return null;
  const onlyOne = (showPersonal && !showShared) || (!showPersonal && showShared);
  if (onlyOne) return null;

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {showPersonal ? (
        <button
          type="button"
          onClick={() => onChange('personal')}
          className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium ${
            value === 'personal' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-white'
          }`}
        >
          내 스크립트·가격
        </button>
      ) : null}
      {showShared ? (
        <button
          type="button"
          onClick={() => onChange('shared')}
          className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium ${
            value === 'shared' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-white'
          }`}
        >
          업체 공통
        </button>
      ) : null}
    </div>
  );
}

export function partitionTelecrmCategories<T extends { ownerScope?: string; ownerUserId?: string | null }>(
  categories: T[],
): { personal: T[]; shared: T[] } {
  const personal: T[] = [];
  const shared: T[] = [];
  for (const c of categories) {
    if (c.ownerScope === 'personal' || c.ownerUserId) personal.push(c);
    else shared.push(c);
  }
  return { personal, shared };
}
