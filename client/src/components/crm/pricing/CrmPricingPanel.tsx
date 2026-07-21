import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import {
  buildOrderOptionTree,
  countOrderOptionTreeItems,
  type OrderOptionTreeNode,
} from './crmOrderOptionTree';
import type { CrmPricingQuoteLine } from '../../../utils/crmConsultationQuoteMap';
import { CrmQuoteRestoreBanner } from './CrmQuoteRestoreBanner';
import type { TelecrmConsultationQuoteDto } from '../../../api/telecrmConsultationQuote';

/** 업체 공통에 표시하는 가상 카테고리 — 발주 전문시공 옵션 */
const ORDERFORM_CATEGORY_ID = '__telecrm_orderform__';

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

function parseAmountInput(raw: string): number | null {
  const trimmed = raw.replace(/,/g, '').trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

function formatQuoteLineCopy(line: CrmPricingQuoteLine): string {
  const pricePart =
    line.amountWon != null ? formatWon(line.amountWon) : line.priceHint?.trim() || '—';
  if (line.source === 'order') {
    return `${line.sublabel ?? line.label} ${pricePart}`;
  }
  return `${line.label} ${pricePart}`;
}

function OrderOptionTreeSection({
  node,
  depth,
  isExpanded,
  onToggle,
  onAdd,
}: {
  node: OrderOptionTreeNode;
  depth: number;
  isExpanded: (key: string) => boolean;
  onToggle: (key: string) => void;
  onAdd: (row: TelecrmOrderOptionDto) => void;
}) {
  const expanded = isExpanded(node.key);
  const count = countOrderOptionTreeItems(node);
  const hasNested = node.children.length > 0 || node.items.length > 0;
  const pad = depth === 0 ? 'px-2' : depth === 1 ? 'pl-5 pr-2' : 'pl-8 pr-2';

  return (
    <li className={depth === 0 ? 'rounded-md border border-amber-100/80 bg-white/60' : ''}>
      {hasNested ? (
        <button
          type="button"
          onClick={() => onToggle(node.key)}
          className={`flex w-full items-center gap-1.5 py-1 text-left hover:bg-amber-50/50 ${pad}`}
        >
          <span
            className={`shrink-0 text-[9px] text-amber-700 transition-transform ${expanded ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ▶
          </span>
          <span
            className={`min-w-0 flex-1 truncate font-semibold text-amber-900 ${depth === 0 ? 'text-[10px]' : 'text-[9px]'}`}
            title={node.label}
          >
            {node.label}
          </span>
          <span className="shrink-0 text-[9px] tabular-nums text-amber-800/70">{count}</span>
        </button>
      ) : null}

      {expanded ? (
        <>
          {node.children.map((child) => (
            <OrderOptionTreeSection
              key={child.key}
              node={child}
              depth={depth + 1}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onAdd={onAdd}
            />
          ))}
          {node.items.length > 0 ? (
            <ul className={depth === 0 ? 'border-t border-amber-50 divide-y divide-slate-100' : 'divide-y divide-slate-50'}>
              {node.items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onAdd(row.row)}
                    className={`flex w-full items-center gap-2 py-1 text-left transition-colors hover:bg-amber-50/60 ${pad}`}
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
        </>
      ) : null}
    </li>
  );
}

const BASE_ESTIMATE_AMOUNT_KEY = '__base_estimate__';

export function CrmPricingPanel({
  pyeong,
  onPyeongChange,
  pricePerPyeong,
  minimumTotalAmount,
  baseEstimateOverrideWon = null,
  onBaseEstimateOverrideChange,
  onPricePerPyeongChange,
  onMinimumTotalAmountChange,
  quoteLines,
  onQuoteLinesChange,
  pendingQuote = null,
  onLoadPendingQuote,
  onDismissPendingQuote,
  onStartFreshQuote,
  quoteSaveError = null,
  quoteSaving = false,
  canFinalizeHold = false,
  onFinalizeHold,
  quoteFinalizing = false,
  quoteFinalizeError = null,
  refreshKey = 0,
  onOpenSettings,
  canSendSoomgoQuote = false,
  onSendSoomgoQuote,
  soomgoQuoteSending = false,
  pricingResetKey = 0,
  compact = false,
}: {
  pyeong: string;
  onPyeongChange: (v: string) => void;
  pricePerPyeong: number;
  minimumTotalAmount: number;
  baseEstimateOverrideWon?: number | null;
  onBaseEstimateOverrideChange?: (v: number | null) => void;
  onPricePerPyeongChange: (v: number) => void;
  onMinimumTotalAmountChange: (v: number) => void;
  quoteLines: CrmPricingQuoteLine[];
  onQuoteLinesChange: (lines: CrmPricingQuoteLine[]) => void;
  pendingQuote?: TelecrmConsultationQuoteDto | null;
  onLoadPendingQuote?: () => void;
  onDismissPendingQuote?: () => void;
  onStartFreshQuote?: () => void;
  quoteSaveError?: string | null;
  quoteSaving?: boolean;
  canFinalizeHold?: boolean;
  onFinalizeHold?: () => void;
  quoteFinalizing?: boolean;
  quoteFinalizeError?: string | null;
  refreshKey?: number;
  onOpenSettings?: () => void;
  canSendSoomgoQuote?: boolean;
  onSendSoomgoQuote?: () => void;
  soomgoQuoteSending?: boolean;
  pricingResetKey?: number;
  compact?: boolean;
}) {
  const token = getToken();
  const [categories, setCategories] = useState<TelecrmPriceCategoryDto[]>([]);
  const [orderOptions, setOrderOptions] = useState<TelecrmOrderOptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedOrderGroups, setExpandedOrderGroups] = useState<Set<string>>(() => new Set());
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pricingResetKey <= 0) return;
    setAmountDrafts({});
    setSearch('');
    setExpandedOrderGroups(new Set());
  }, [pricingResetKey]);

  const setQuoteLines = onQuoteLinesChange;

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
      onPricePerPyeongChange(catalogRes.estimateConfig.pricePerPyeong);
      onMinimumTotalAmountChange(catalogRes.estimateConfig.minimumTotalAmount ?? 0);

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
  }, [token, search, onPricePerPyeongChange, onMinimumTotalAmountChange]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadCatalog(), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [loadCatalog, search]);

  useEffect(() => {
    if (refreshKey === 0) return;
    void loadCatalog();
  }, [refreshKey, loadCatalog]);

  const pyeongNum = parseFloat(pyeong.replace(/,/g, ''));
  const catalogBaseEstimate =
    Number.isFinite(pyeongNum) && pyeongNum > 0 && pricePerPyeong > 0
      ? computeEstimateTotalFromPyeong(pyeongNum, pricePerPyeong, minimumTotalAmount)
      : null;
  const estimatedBase = baseEstimateOverrideWon ?? catalogBaseEstimate;
  const rawBase =
    Number.isFinite(pyeongNum) && pyeongNum > 0 && pricePerPyeong > 0
      ? Math.round(pyeongNum * pricePerPyeong)
      : null;
  const minimumApplied =
    baseEstimateOverrideWon == null &&
    minimumTotalAmount > 0 &&
    catalogBaseEstimate != null &&
    rawBase != null &&
    catalogBaseEstimate > rawBase;

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
    const catalogAmount = orderOptionAmount(row);
    setQuoteLines([
      ...quoteLines,
      {
        key: `order:${row.id}:${Date.now()}`,
        label: row.emoji ? `${row.emoji} ${row.label}` : row.label,
        sublabel: row.labelPath,
        source: 'order',
        optionId: row.id,
        catalogAmountWon: catalogAmount,
        amountWon: catalogAmount,
        priceHint: row.priceHint,
      },
    ]);
  }, [quoteLines, setQuoteLines]);

  const activeCategory = useMemo(() => {
    if (isOrderformCategory) return null;
    return categories.find((c) => c.id === categoryId) ?? categories[0] ?? null;
  }, [categories, categoryId, isOrderformCategory]);

  const orderOptionTree = useMemo(
    () => buildOrderOptionTree(orderOptions, formatOrderOptionPrice),
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

  const updateQuoteLineAmount = useCallback(
    (key: string, raw: string) => {
      setAmountDrafts((prev) => ({ ...prev, [key]: raw }));
      const parsed = parseAmountInput(raw);
      if (raw.trim() !== '' && parsed === null) return;
      setQuoteLines(quoteLines.map((line) => (line.key === key ? { ...line, amountWon: parsed } : line)));
    },
    [quoteLines, setQuoteLines],
  );

  const updateBaseEstimateAmount = useCallback(
    (raw: string) => {
      setAmountDrafts((prev) => ({ ...prev, [BASE_ESTIMATE_AMOUNT_KEY]: raw }));
      const parsed = parseAmountInput(raw);
      if (raw.trim() !== '' && parsed === null) return;
      onBaseEstimateOverrideChange?.(parsed);
    },
    [onBaseEstimateOverrideChange],
  );

  const resetBaseEstimateAmount = useCallback(() => {
    setAmountDrafts((drafts) => {
      const next = { ...drafts };
      delete next[BASE_ESTIMATE_AMOUNT_KEY];
      return next;
    });
    onBaseEstimateOverrideChange?.(null);
  }, [onBaseEstimateOverrideChange]);

  const resetQuoteLineAmount = useCallback(
    (key: string) => {
      const line = quoteLines.find((l) => l.key === key);
      if (!line) return;
      setAmountDrafts((drafts) => {
        const next = { ...drafts };
        if (line.catalogAmountWon != null) next[key] = String(line.catalogAmountWon);
        else delete next[key];
        return next;
      });
      setQuoteLines(
        quoteLines.map((l) => (l.key === key ? { ...l, amountWon: l.catalogAmountWon } : l)),
      );
    },
    [quoteLines, setQuoteLines],
  );

  const amountInputValue = (line: CrmPricingQuoteLine): string => {
    if (line.key in amountDrafts) return amountDrafts[line.key] ?? '';
    if (line.amountWon != null) return String(line.amountWon);
    return '';
  };

  const baseAmountInputValue = (): string => {
    if (BASE_ESTIMATE_AMOUNT_KEY in amountDrafts) return amountDrafts[BASE_ESTIMATE_AMOUNT_KEY] ?? '';
    if (estimatedBase != null) return String(estimatedBase);
    return '';
  };

  const showBaseAmountReset = baseEstimateOverrideWon != null;

  const priceMenuItems: { id: string; onAdd: () => void; label: string; sublabel?: string; price: string }[] =
    useMemo(() => {
      return (activeCategory?.items ?? []).map((item: TelecrmPriceItemDto) => ({
        id: item.id,
        label: item.name,
        sublabel: item.description ?? undefined,
        price: formatWon(item.amountWon),
        onAdd: () => {
          setQuoteLines([
            ...quoteLines,
            {
              key: `item:${item.id}:${Date.now()}`,
              label: item.name,
              source: 'telecrm',
              itemId: item.id,
              catalogAmountWon: item.amountWon,
              amountWon: item.amountWon,
            },
          ]);
        },
      }));
    }, [activeCategory?.items, quoteLines, setQuoteLines]);

  const buildQuoteCopyText = useCallback(() => {
    const lines: string[] = [];
    if (estimatedBase != null && Number.isFinite(pyeongNum) && pyeongNum > 0) {
      lines.push(`${pyeongNum}평 기본견적 ${formatWon(estimatedBase)}`);
    }
    for (const line of quoteLines) {
      lines.push(`+ ${formatQuoteLineCopy(line)}`);
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

  const renderQuoteAmountEditor = (line: CrmPricingQuoteLine): ReactNode => {
    const showReset =
      line.catalogAmountWon !== line.amountWon ||
      (line.catalogAmountWon == null && line.amountWon != null);
    return (
      <span className="flex shrink-0 items-center gap-0.5">
        <input
          type="text"
          inputMode="numeric"
          value={amountInputValue(line)}
          placeholder={line.priceHint?.trim() || '원'}
          onChange={(e) => updateQuoteLineAmount(line.key, e.target.value)}
          onBlur={() => {
            setAmountDrafts((prev) => {
              const next = { ...prev };
              delete next[line.key];
              return next;
            });
          }}
          className="w-[4.5rem] rounded border border-amber-200/80 bg-white px-1 py-0.5 text-right text-[10px] tabular-nums"
          title="안내 금액 (직접 입력)"
        />
        {showReset ? (
          <button
            type="button"
            title="카탈로그 가격으로"
            onClick={() => resetQuoteLineAmount(line.key)}
            className="rounded px-0.5 text-[9px] text-amber-700 hover:bg-amber-100"
          >
            ↺
          </button>
        ) : null}
      </span>
    );
  };

  return (
    <CrmColumn
      accent="pricing"
      title="가격 안내"
      subtitle={compact ? '항목 클릭 → 안내 목록' : '항목 클릭 → 안내 목록에 추가 · 하단 합계'}
      disableBodyScroll
      bodyClassName="p-0"
      className={compact ? 'min-h-0' : undefined}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {pendingQuote && onLoadPendingQuote && onDismissPendingQuote && onStartFreshQuote ? (
          <CrmQuoteRestoreBanner
            quote={pendingQuote}
            onLoad={onLoadPendingQuote}
            onDismiss={onDismissPendingQuote}
            onStartFresh={onStartFreshQuote}
          />
        ) : null}
        {quoteSaveError ? (
          <p className="shrink-0 border-b border-red-100 bg-red-50 px-2 py-1 text-[10px] text-red-700">{quoteSaveError}</p>
        ) : null}
        {quoteSaving ? (
          <p className="shrink-0 border-b border-amber-50 px-2 py-0.5 text-[9px] text-amber-700/80">견적 저장 중…</p>
        ) : null}
        {quoteFinalizeError ? (
          <p className="shrink-0 border-b border-red-100 bg-red-50 px-2 py-1 text-[10px] text-red-700">{quoteFinalizeError}</p>
        ) : null}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {loading ? (
            <p className="text-[11px] text-gray-500">불러오는 중…</p>
          ) : error ? (
            <p className="text-[11px] text-red-600">{error}</p>
          ) : isOrderformCategory ? (
            orderOptionTree.length === 0 ? (
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
                {orderOptionTree.map((node) => (
                  <OrderOptionTreeSection
                    key={node.key}
                    node={node}
                    depth={0}
                    isExpanded={isOrderGroupExpanded}
                    onToggle={toggleOrderGroup}
                    onAdd={addOrderOptionToQuote}
                  />
                ))}
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

        <div
          className={`shrink-0 border-t border-amber-200/80 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.04)] ${CRM_ACCENT.pricing.panel}`}
        >
          {(estimatedBase != null || quoteLines.length > 0) && (
            <div className={`${compact ? 'max-h-28' : 'max-h-36'} overflow-y-auto border-b border-amber-100/60 px-2 py-1`}>
              <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800/70">
                안내 목록 · 금액 입력/↺ 재설정
              </p>
              <ul className="space-y-1">
                {estimatedBase != null && Number.isFinite(pyeongNum) && pyeongNum > 0 ? (
                  <li className="flex items-center gap-1 text-[10px]">
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800" title={`${pyeongNum}평 기본견적`}>
                      {pyeongNum}평 기본견적
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={baseAmountInputValue()}
                        onChange={(e) => updateBaseEstimateAmount(e.target.value)}
                        onBlur={() => {
                          setAmountDrafts((prev) => {
                            const next = { ...prev };
                            delete next[BASE_ESTIMATE_AMOUNT_KEY];
                            return next;
                          });
                        }}
                        className="w-[4.5rem] rounded border border-amber-200/80 bg-white px-1 py-0.5 text-right text-[10px] tabular-nums"
                        title="기본견적 금액 (직접 입력)"
                      />
                      {showBaseAmountReset ? (
                        <button
                          type="button"
                          title="평당·최소 설정 기준으로"
                          onClick={resetBaseEstimateAmount}
                          className="rounded px-0.5 text-[9px] text-amber-700 hover:bg-amber-100"
                        >
                          ↺
                        </button>
                      ) : null}
                    </span>
                  </li>
                ) : null}
                {quoteLines.map((line) => (
                  <li key={line.key} className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      title="제거"
                      onClick={() => setQuoteLines(quoteLines.filter((l) => l.key !== line.key))}
                      className="shrink-0 rounded px-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                    <span className="min-w-0 flex-1 truncate text-gray-700" title={line.label}>
                      + {line.label}
                    </span>
                    {renderQuoteAmountEditor(line)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-1.5 px-2 py-1.5">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-amber-900/70">합계</p>
              <p className="text-sm font-bold tabular-nums text-amber-900">
                {grandTotal != null ? formatWon(grandTotal) : '—'}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {canSendSoomgoQuote && onSendSoomgoQuote ? (
                <button
                  type="button"
                  onClick={onSendSoomgoQuote}
                  disabled={soomgoQuoteSending || (grandTotal == null && quoteLines.length === 0 && estimatedBase == null)}
                  className="inline-flex items-center rounded-md bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
                  title="설정된 견적보내기 서식으로 숨고 채팅 전송"
                >
                  {soomgoQuoteSending ? '전송 중…' : '견적보내기'}
                </button>
              ) : null}
              {canFinalizeHold && onFinalizeHold ? (
                <button
                  type="button"
                  onClick={onFinalizeHold}
                  disabled={quoteFinalizing || (grandTotal == null && quoteLines.length === 0 && estimatedBase == null)}
                  className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  title="견적 확정 + 부재/보류 등록 (처리구분: 부재·보류)"
                >
                  {quoteFinalizing ? '저장 중…' : '견적 저장 · 보류'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void copyAll()}
                disabled={grandTotal == null && quoteLines.length === 0}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900 transition-colors hover:bg-amber-50 disabled:opacity-40"
              >
                <CrmIconCopy className="h-3 w-3" />
                {copiedAll ? '복사됨' : '전체 복사'}
              </button>
              {quoteLines.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuoteLines([]);
                    setAmountDrafts({});
                  }}
                  className="text-[10px] text-gray-500 underline hover:text-gray-800"
                >
                  비우기
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </CrmColumn>
  );
}
