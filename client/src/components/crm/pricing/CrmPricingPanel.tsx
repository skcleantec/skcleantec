import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmOrderOptions,
  fetchTelecrmPricingCatalog,
  type TelecrmOrderOptionDto,
  type TelecrmPriceCategoryDto,
  type TelecrmPriceItemDto,
} from '../../../api/telecrm';
import { formatWon, partitionTelecrmCategories } from '../settings/telecrmSettingsUi';
import { CrmColumn } from '../layout/CrmShell';
import {
  CrmActionButton,
  CrmChip,
  CrmIconCopy,
  CrmIconSearch,
  CrmSectionLabel,
  CRM_ACCENT,
} from '../crmUi';
import { computeEstimateTotalFromPyeong } from '@shared/estimateTotal';

/** 업체 공통에 표시하는 가상 카테고리 — 발주 전문시공 옵션 */
const ORDERFORM_CATEGORY_ID = '__telecrm_orderform__';

type QuoteLine = {
  key: string;
  label: string;
  sublabel?: string;
  amountWon: number | null;
  copyText: string;
};

function formatOrderOptionPrice(row: TelecrmOrderOptionDto): string {
  const parts: string[] = [];
  if (row.priceAmount != null && row.priceAmount > 0) {
    parts.push(formatWon(row.priceAmount));
  }
  if (row.priceHint?.trim()) parts.push(row.priceHint.trim());
  return parts.join(' · ') || '—';
}

function orderOptionAmount(row: TelecrmOrderOptionDto): number | null {
  if (row.priceAmount != null && row.priceAmount > 0) return row.priceAmount;
  return null;
}

type OrderOptionMenuItem = {
  id: string;
  label: string;
  price: string;
  row: TelecrmOrderOptionDto;
};

type OrderOptionGroup = {
  key: string;
  label: string;
  items: OrderOptionMenuItem[];
};

/** labelPath 상위 경로(마지막 항목명 제외)로 발주 전문시공 그룹화 */
function groupOrderOptionsByCategory(orderOptions: TelecrmOrderOptionDto[]): OrderOptionGroup[] {
  const map = new Map<string, OrderOptionGroup>();
  for (const row of orderOptions) {
    const parts = row.labelPath
      .split('›')
      .map((s) => s.trim())
      .filter(Boolean);
    const groupLabel = parts.length > 1 ? parts.slice(0, -1).join(' › ') : '기타';
    let group = map.get(groupLabel);
    if (!group) {
      group = { key: groupLabel, label: groupLabel, items: [] };
      map.set(groupLabel, group);
    }
    group.items.push({
      id: row.id,
      label: row.emoji ? `${row.emoji} ${row.label}` : row.label,
      price: formatOrderOptionPrice(row),
      row,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

export function CrmPricingPanel({
  pyeong,
  onPyeongChange,
  refreshKey = 0,
  onOpenSettings,
}: {
  pyeong: string;
  onPyeongChange: (v: string) => void;
  refreshKey?: number;
  onOpenSettings?: () => void;
}) {
  const token = getToken();
  const [categories, setCategories] = useState<TelecrmPriceCategoryDto[]>([]);
  const [orderOptions, setOrderOptions] = useState<TelecrmOrderOptionDto[]>([]);
  const [pricePerPyeong, setPricePerPyeong] = useState(0);
  const [minimumTotalAmount, setMinimumTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedOrderGroups, setExpandedOrderGroups] = useState<Set<string>>(() => new Set());

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, orderRes] = await Promise.all([
        fetchTelecrmPricingCatalog(token, search),
        fetchTelecrmOrderOptions(token, search),
      ]);
      setCategories(catalogRes.categories);
      setOrderOptions(orderRes.items);
      setPricePerPyeong(catalogRes.estimateConfig.pricePerPyeong);
      setMinimumTotalAmount(catalogRes.estimateConfig.minimumTotalAmount ?? 0);

      const hasOrderOptions = orderRes.items.length > 0;
      const firstCatId = catalogRes.categories[0]?.id ?? null;
      setCategoryId((prev) => {
        if (prev === ORDERFORM_CATEGORY_ID && hasOrderOptions) return prev;
        if (prev && catalogRes.categories.some((c) => c.id === prev)) return prev;
        return firstCatId ?? (hasOrderOptions ? ORDERFORM_CATEGORY_ID : null);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '가격 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadCatalog(), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [loadCatalog, search]);

  useEffect(() => {
    if (refreshKey === 0) return;
    void loadCatalog();
  }, [refreshKey, loadCatalog]);

  const pyeongNum = parseFloat(pyeong.replace(/,/g, ''));
  const estimatedBase =
    Number.isFinite(pyeongNum) && pyeongNum > 0 && pricePerPyeong > 0
      ? computeEstimateTotalFromPyeong(pyeongNum, pricePerPyeong, minimumTotalAmount)
      : null;
  const rawBase =
    Number.isFinite(pyeongNum) && pyeongNum > 0 && pricePerPyeong > 0
      ? Math.round(pyeongNum * pricePerPyeong)
      : null;
  const minimumApplied =
    minimumTotalAmount > 0 &&
    estimatedBase != null &&
    rawBase != null &&
    estimatedBase > rawBase;

  const extrasTotal = useMemo(
    () => quoteLines.reduce((sum, line) => sum + (line.amountWon ?? 0), 0),
    [quoteLines],
  );
  const grandTotal =
    estimatedBase != null ? estimatedBase + extrasTotal : extrasTotal > 0 ? extrasTotal : null;

  const { personal: personalCategories, shared: sharedCategories } = useMemo(() => {
    const { personal, shared } = partitionTelecrmCategories(categories);
    const sharedWithOrder =
      orderOptions.length > 0
        ? [
            ...shared,
            {
              id: ORDERFORM_CATEGORY_ID,
              label: '발주 전문시공',
              sortOrder: 9999,
              isActive: true,
            } satisfies TelecrmPriceCategoryDto,
          ]
        : shared;
    return { personal, shared: sharedWithOrder };
  }, [categories, orderOptions.length]);

  const isOrderformCategory = categoryId === ORDERFORM_CATEGORY_ID;

  const addOrderOptionToQuote = useCallback((row: TelecrmOrderOptionDto) => {
    const amount = orderOptionAmount(row);
    setQuoteLines((prev) => [
      ...prev,
      {
        key: `order:${row.id}:${Date.now()}`,
        label: row.emoji ? `${row.emoji} ${row.label}` : row.label,
        sublabel: row.labelPath,
        amountWon: amount,
        copyText: `${row.labelPath} ${formatOrderOptionPrice(row)}`,
      },
    ]);
  }, []);

  const activeCategory = useMemo(() => {
    if (isOrderformCategory) return null;
    return categories.find((c) => c.id === categoryId) ?? categories[0] ?? null;
  }, [categories, categoryId, isOrderformCategory]);

  const orderOptionGroups = useMemo(
    () => groupOrderOptionsByCategory(orderOptions),
    [orderOptions],
  );

  const searchExpanded = search.trim().length > 0;

  const toggleOrderGroup = useCallback((key: string) => {
    setExpandedOrderGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isOrderGroupExpanded = useCallback(
    (key: string) => searchExpanded || expandedOrderGroups.has(key),
    [expandedOrderGroups, searchExpanded],
  );

  const priceMenuItems: { id: string; onAdd: () => void; label: string; sublabel?: string; price: string }[] =
    useMemo(() => {
      return (activeCategory?.items ?? []).map((item: TelecrmPriceItemDto) => ({
        id: item.id,
        label: item.name,
        sublabel: item.description ?? undefined,
        price: formatWon(item.amountWon),
        onAdd: () => {
          setQuoteLines((prev) => [
            ...prev,
            {
              key: `item:${item.id}:${Date.now()}`,
              label: item.name,
              amountWon: item.amountWon,
              copyText: `${item.name} ${formatWon(item.amountWon)}`,
            },
          ]);
        },
      }));
    }, [activeCategory?.items]);

  const buildQuoteCopyText = useCallback(() => {
    const lines: string[] = [];
    if (estimatedBase != null && Number.isFinite(pyeongNum) && pyeongNum > 0) {
      lines.push(`${pyeongNum}평 기본견적 ${formatWon(estimatedBase)}`);
    }
    for (const line of quoteLines) {
      lines.push(`+ ${line.copyText}`);
    }
    if (grandTotal != null) {
      lines.push(`합계 ${formatWon(grandTotal)}`);
    }
    return lines.join('\n');
  }, [estimatedBase, grandTotal, pyeongNum, quoteLines]);

  const copyAll = async () => {
    const text = buildQuoteCopyText();
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const renderCategoryButtons = (list: TelecrmPriceCategoryDto[]) =>
    list.map((c) => (
      <CrmChip
        key={c.id}
        accent="pricing"
        active={categoryId === c.id}
        onClick={() => setCategoryId(c.id)}
        compact
      >
        {c.label}
      </CrmChip>
    ));

  return (
    <CrmColumn
      accent="pricing"
      title="가격 안내"
      subtitle="항목 클릭 → 안내 목록에 추가 · 하단 합계"
      disableBodyScroll
      bodyClassName="p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* 상단: 검색·평수 — 컴팩트 */}
        <div className={`shrink-0 space-y-1.5 border-b border-amber-100/80 px-2 py-1.5 ${CRM_ACCENT.pricing.panel}`}>
          <div className="relative">
            <CrmIconSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-600/70" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="항목 검색…"
              className="w-full rounded-md border border-amber-200/80 bg-white py-1 pl-7 pr-2 text-[11px] outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-amber-900/90">
            <span className="font-semibold">평당 {formatWon(pricePerPyeong)}</span>
            {minimumTotalAmount > 0 ? (
              <span className="text-amber-800/70">· 최소 {formatWon(minimumTotalAmount)}</span>
            ) : null}
            <span className="ml-auto flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={pyeong}
                onChange={(e) => onPyeongChange(e.target.value)}
                placeholder="평수"
                className="w-14 rounded border border-amber-200/80 bg-white px-1.5 py-0.5 text-center text-[11px] tabular-nums"
              />
              <span>평</span>
            </span>
          </div>
          {minimumApplied ? (
            <p className="text-[9px] text-amber-800/80">최소 금액 적용됨</p>
          ) : null}
        </div>

        {/* 카테고리 칩 */}
        {!loading && !error ? (
          <div className="shrink-0 space-y-1 border-b border-slate-100 px-2 py-1.5">
            {personalCategories.length > 0 ? (
              <div>
                <CrmSectionLabel accent="pricing">내 가격</CrmSectionLabel>
                <div className="flex flex-wrap gap-1">{renderCategoryButtons(personalCategories)}</div>
              </div>
            ) : null}
            {sharedCategories.length > 0 ? (
              <div>
                <CrmSectionLabel accent="pricing">업체 공통</CrmSectionLabel>
                <div className="flex flex-wrap gap-1">{renderCategoryButtons(sharedCategories)}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 메뉴 목록 — 스크롤 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {loading ? (
            <p className="text-[11px] text-gray-500">불러오는 중…</p>
          ) : error ? (
            <p className="text-[11px] text-red-600">{error}</p>
          ) : isOrderformCategory ? (
            orderOptionGroups.length === 0 ? (
              <div className="space-y-2 text-[11px] text-gray-500">
                <p>전문시공 옵션이 없습니다.</p>
                {onOpenSettings ? (
                  <CrmActionButton accent="pricing" onClick={onOpenSettings}>
                    발주서 설정
                  </CrmActionButton>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {orderOptionGroups.map((group) => {
                  const expanded = isOrderGroupExpanded(group.key);
                  return (
                    <li key={group.key} className="rounded-md border border-amber-100/80 bg-white/60">
                      <button
                        type="button"
                        onClick={() => toggleOrderGroup(group.key)}
                        className="flex w-full items-center gap-1.5 px-2 py-1 text-left hover:bg-amber-50/50"
                      >
                        <span
                          className={`shrink-0 text-[9px] text-amber-700 transition-transform ${expanded ? 'rotate-90' : ''}`}
                          aria-hidden
                        >
                          ▶
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-amber-900" title={group.label}>
                          {group.label}
                        </span>
                        <span className="shrink-0 text-[9px] tabular-nums text-amber-800/70">{group.items.length}</span>
                      </button>
                      {expanded ? (
                        <ul className="border-t border-amber-50 divide-y divide-slate-100">
                          {group.items.map((row) => (
                            <li key={row.id}>
                              <button
                                type="button"
                                onClick={() => addOrderOptionToQuote(row.row)}
                                className="flex w-full items-center gap-2 py-1 pl-5 pr-2 text-left transition-colors hover:bg-amber-50/60"
                              >
                                <span
                                  className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-900"
                                  title={row.label}
                                >
                                  {row.label}
                                </span>
                                <span className="shrink-0 text-[11px] font-bold tabular-nums text-amber-700">
                                  {row.price}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          ) : priceMenuItems.length === 0 ? (
            <div className="space-y-2 text-[11px] text-gray-500">
              <p>항목이 없습니다.</p>
              {onOpenSettings ? (
                <CrmActionButton accent="pricing" onClick={onOpenSettings}>
                  가격 항목 추가
                </CrmActionButton>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {priceMenuItems.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={row.onAdd}
                    className="flex w-full items-center gap-2 py-1.5 text-left transition-colors hover:bg-amber-50/60"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-900" title={row.label}>
                      {row.label}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-amber-700">{row.price}</span>
                  </button>
                  {row.sublabel ? (
                    <p className="pb-1 pl-0 text-[9px] text-gray-400 line-clamp-1" title={row.sublabel}>
                      {row.sublabel}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 안내 히스토리 + 하단 합계 */}
        <div
          className={`shrink-0 border-t border-amber-200/80 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.04)] ${CRM_ACCENT.pricing.panel}`}
        >
          {(estimatedBase != null || quoteLines.length > 0) && (
            <div className="max-h-32 overflow-y-auto border-b border-amber-100/60 px-2 py-1">
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800/70">
                안내 목록
              </p>
              <ul className="space-y-0.5">
                {estimatedBase != null && Number.isFinite(pyeongNum) && pyeongNum > 0 ? (
                  <li className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate text-gray-700">{pyeongNum}평 기본견적</span>
                    <span className="shrink-0 font-semibold tabular-nums text-amber-800">
                      {formatWon(estimatedBase)}
                    </span>
                  </li>
                ) : null}
                {quoteLines.map((line) => (
                  <li key={line.key} className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      title="제거"
                      onClick={() => setQuoteLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="shrink-0 rounded px-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                    <span className="min-w-0 flex-1 truncate text-gray-700" title={line.label}>
                      + {line.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-amber-800">
                      {line.amountWon != null ? formatWon(line.amountWon) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold text-amber-900/70">합계</p>
              <p className="text-sm font-bold tabular-nums text-amber-900">
                {grandTotal != null ? formatWon(grandTotal) : '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyAll()}
              disabled={grandTotal == null && quoteLines.length === 0}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/80 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900 transition-colors hover:bg-amber-50 disabled:opacity-40"
            >
              <CrmIconCopy className="h-3 w-3" />
              {copiedAll ? '복사됨' : '전체 복사'}
            </button>
            {quoteLines.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuoteLines([])}
                className="shrink-0 text-[10px] text-gray-500 underline hover:text-gray-800"
              >
                비우기
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </CrmColumn>
  );
}
