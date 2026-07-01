import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmOrderOptions,
  fetchTelecrmPricingCatalog,
  type TelecrmOrderOptionDto,
  type TelecrmPriceCategoryDto,
} from '../../../api/telecrm';
import { formatWon } from '../settings/telecrmSettingsUi';
import { CrmColumn } from '../layout/CrmShell';

type PriceSource = 'telecrm' | 'orderform';

function formatOrderOptionPrice(row: TelecrmOrderOptionDto): string {
  const parts: string[] = [];
  if (row.priceAmount != null && row.priceAmount > 0) {
    parts.push(formatWon(row.priceAmount));
  }
  if (row.priceHint?.trim()) parts.push(row.priceHint.trim());
  return parts.join(' · ') || '—';
}

export function CrmPricingPanel({
  pyeong,
  onPyeongChange,
}: {
  pyeong: string;
  onPyeongChange: (v: string) => void;
}) {
  const token = getToken();
  const [source, setSource] = useState<PriceSource>('telecrm');
  const [categories, setCategories] = useState<TelecrmPriceCategoryDto[]>([]);
  const [orderOptions, setOrderOptions] = useState<TelecrmOrderOptionDto[]>([]);
  const [pricePerPyeong, setPricePerPyeong] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadTelecrm = useCallback(async () => {
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

  const loadOrderOptions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmOrderOptions(token, search);
      setOrderOptions(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '발주 옵션을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (source === 'telecrm') void loadTelecrm();
      else void loadOrderOptions();
    }, search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [source, loadTelecrm, loadOrderOptions, search]);

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

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const copyAmount = async (itemId: string, amount: number, label: string) => {
    await copyText(itemId, `${label} ${formatWon(amount)}`);
  };

  const copyOrderOption = async (row: TelecrmOrderOptionDto) => {
    const price = formatOrderOptionPrice(row);
    await copyText(row.id, `${row.labelPath} ${price}`);
  };

  return (
    <CrmColumn
      title="가격 안내"
      subtitle={
        source === 'telecrm'
          ? '텔레CRM 단가표 · 클릭하면 복사'
          : '발주서 전문시공 옵션 · 클릭하면 복사'
      }
    >
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <button
            type="button"
            onClick={() => setSource('telecrm')}
            className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium ${
              source === 'telecrm' ? 'bg-slate-900 text-white' : 'text-gray-600'
            }`}
          >
            텔레CRM 가격
          </button>
          <button
            type="button"
            onClick={() => setSource('orderform')}
            className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium ${
              source === 'orderform' ? 'bg-slate-900 text-white' : 'text-gray-600'
            }`}
          >
            발주 전문시공
          </button>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="항목 검색…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
        />

        {source === 'telecrm' ? (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
            <p className="text-fluid-xs font-medium text-indigo-900">
              예상 총액 (평당 {formatWon(pricePerPyeong)})
            </p>
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
        ) : (
          <p className="text-[10px] text-gray-500">
            발주서 설정의 전문시공 옵션 금액입니다. 텔레CRM 단가표와 별도로 관리됩니다.
          </p>
        )}

        {loading ? (
          <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : error ? (
          <p className="text-fluid-sm text-red-600">{error}</p>
        ) : source === 'telecrm' ? (
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
        ) : (
          <ul className="space-y-2">
            {orderOptions.length === 0 ? (
              <li className="text-fluid-sm text-gray-500">
                금액이 있는 전문시공 옵션이 없습니다. 발주서 설정에서 옵션을 등록하세요.
              </li>
            ) : (
              orderOptions.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void copyOrderOption(row)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-fluid-sm font-medium text-gray-900 truncate" title={row.label}>
                          {row.emoji ? `${row.emoji} ` : ''}
                          {row.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-500 truncate" title={row.labelPath}>
                          {row.labelPath}
                        </p>
                      </div>
                      <span className="shrink-0 text-fluid-sm font-semibold text-indigo-700 tabular-nums">
                        {formatOrderOptionPrice(row)}
                      </span>
                    </div>
                    {copiedId === row.id ? (
                      <p className="mt-1 text-fluid-xs text-green-600">복사됨</p>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </CrmColumn>
  );
}
