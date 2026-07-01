import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { fetchTelecrmPricingCatalog, type TelecrmPriceCategoryDto } from '../../../api/telecrm';
import { formatWon } from '../settings/telecrmSettingsUi';
import { CrmColumn } from '../layout/CrmShell';

export function CrmPricingPanel({
  pyeong,
  onPyeongChange,
}: {
  pyeong: string;
  onPyeongChange: (v: string) => void;
}) {
  const token = getToken();
  const [categories, setCategories] = useState<TelecrmPriceCategoryDto[]>([]);
  const [pricePerPyeong, setPricePerPyeong] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmPricingCatalog(token, search);
      setCategories(res.categories);
      setPricePerPyeong(res.estimateConfig.pricePerPyeong);
      if (res.categories.length > 0) {
        setCategoryId((prev) => {
          if (prev && res.categories.some((c) => c.id === prev)) return prev;
          return res.categories[0]?.id ?? null;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '가격 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? categories[0] ?? null,
    [categories, categoryId],
  );

  const items = activeCategory?.items ?? [];

  const pyeongNum = parseFloat(pyeong.replace(/,/g, ''));
  const estimatedTotal =
    Number.isFinite(pyeongNum) && pyeongNum > 0 && pricePerPyeong > 0
      ? Math.round(pyeongNum * pricePerPyeong)
      : null;

  const copyAmount = async (itemId: string, amount: number, label: string) => {
    const text = `${label} ${formatWon(amount)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(itemId);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <CrmColumn title="가격 안내" subtitle="클릭하면 금액이 클립보드에 복사됩니다">
      <div className="space-y-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="항목 검색…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
        />

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
          <p className="text-fluid-xs font-medium text-indigo-900">예상 총액 (평당 {formatWon(pricePerPyeong)})</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={pyeong}
              onChange={(e) => onPyeongChange(e.target.value)}
              placeholder="평수"
              className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-fluid-sm text-center tabular-nums"
            />
            <span className="text-fluid-sm text-gray-600">평</span>
            <span className="ml-auto text-fluid-sm font-semibold text-indigo-800 tabular-nums">
              {estimatedTotal != null ? formatWon(estimatedTotal) : '—'}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : error ? (
          <p className="text-fluid-sm text-red-600">{error}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`rounded-lg px-3 py-1.5 text-fluid-xs font-medium ${
                    activeCategory?.id === c.id
                      ? 'bg-slate-900 text-white'
                      : 'border border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <ul className="space-y-2">
              {items.length === 0 ? (
                <li className="text-fluid-sm text-gray-500">항목이 없습니다.</li>
              ) : (
                items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void copyAmount(item.id, item.amountWon, item.name)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-fluid-sm font-medium text-gray-900">{item.name}</span>
                        <span className="shrink-0 text-fluid-sm font-semibold text-indigo-700 tabular-nums">
                          {formatWon(item.amountWon)}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-1 text-fluid-xs text-gray-500 line-clamp-2">{item.description}</p>
                      ) : null}
                      {copiedId === item.id ? (
                        <p className="mt-1 text-fluid-xs text-green-600">복사됨</p>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </CrmColumn>
  );
}
