import { useEffect, useRef, type ReactNode } from 'react';
import type { DbMarketplaceMaskedItem } from '../../api/dbMarketplace';
import {
  formatMarketplaceCleaningSummary,
  formatMarketplaceSchedule,
  formatMarketplaceListDate,
} from '../../utils/dbMarketplaceDisplay';
import {
  marketplaceBulkSelectDisabledReason,
  type DbMarketplaceBulkMode,
} from '../../utils/dbMarketplaceBulk';
import { DbMarketplaceStatusBadge } from './marketplaceUiParts';
import {
  formatWon,
  resolveMarketplaceBuyerTotalFee,
  resolveMarketplaceCustomerBalance,
} from './DbMarketplaceAmountSummary';

/** PC 표 — 선택 열 px (데스크톱) */
export const MARKETPLACE_TABLE_CHECKBOX_COL_PX = 36;

/** 모바일 카드 — 터치 최소 영역 (iOS·Android 권장 44px) */
export const MARKETPLACE_MOBILE_CHECKBOX_TOUCH_PX = 44;

export function MarketplaceBulkSelectCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  'aria-label': ariaLabel,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  'aria-label'?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        e.stopPropagation();
        onChange();
      }}
      onClick={(e) => e.stopPropagation()}
      className={className ?? marketplaceTableCheckboxInputClass}
    />
  );
}

/** 모바일 목록 상단 — 현재 페이지 전체·일부 선택 */
export function DbMarketplaceMobilePageSelectBar({
  selectable,
  selectableOnPageCount,
  allPageSelected,
  partialPageSelected,
  onToggleAllPage,
}: {
  selectable: boolean;
  selectableOnPageCount: number;
  allPageSelected: boolean;
  partialPageSelected: boolean;
  onToggleAllPage: () => void;
}) {
  if (!selectable || selectableOnPageCount === 0) return null;

  const label = allPageSelected
    ? '현재 페이지 전체 선택됨'
    : partialPageSelected
      ? '일부 선택'
      : '현재 페이지 전체 선택';

  return (
    <div className="mt-2 border-b border-gray-100 pb-2 lg:hidden sm:mt-3 sm:pb-3">
      <label className="flex min-h-9 cursor-pointer touch-manipulation select-none items-center gap-2 sm:min-h-11 sm:gap-3">
        <MarketplaceBulkSelectCheckbox
          checked={allPageSelected}
          indeterminate={partialPageSelected}
          onChange={onToggleAllPage}
          aria-label={label}
          className="size-4 shrink-0 accent-slate-900 sm:size-5"
        />
        <span className="text-fluid-2xs font-medium text-slate-800 sm:text-fluid-xs">{label}</span>
        {partialPageSelected ? (
          <span className="text-fluid-2xs text-gray-500">탭하여 전체 선택·해제</span>
        ) : null}
      </label>
    </div>
  );
}

function checkboxColWidthCss() {
  return `${MARKETPLACE_TABLE_CHECKBOX_COL_PX}px`;
}

export function MarketplaceTableCheckboxCol() {
  const w = checkboxColWidthCss();
  return <col width={MARKETPLACE_TABLE_CHECKBOX_COL_PX} style={{ width: w, minWidth: w, maxWidth: w }} />;
}

export function marketplaceTableCheckboxCellProps(): {
  className: string;
  style: { width: string; minWidth: string; maxWidth: string };
} {
  const w = checkboxColWidthCss();
  return {
    className: 'box-border px-1 py-2 text-center align-middle',
    style: { width: w, minWidth: w, maxWidth: w },
  };
}

export const marketplaceTableCheckboxInputClass =
  'mx-auto block size-4 shrink-0 cursor-pointer accent-slate-900 touch-manipulation';

export function DbMarketplaceTabBar<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="w-full min-w-0 -mx-4 px-4 sm:mx-0 sm:px-0">
      <div
        className="flex max-w-full flex-nowrap gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white p-0.5 [scrollbar-width:thin] sm:gap-1 sm:p-1"
        role="tablist"
        aria-label="정보공유 탭"
      >
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active === opt.id}
            onClick={() => onChange(opt.id)}
            className={`shrink-0 rounded-md px-2 py-1 text-fluid-2xs font-medium transition-colors whitespace-nowrap sm:px-3 sm:py-2 sm:text-fluid-xs ${
              active === opt.id ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DbMarketplaceBulkActionBar({
  selectedCount,
  onClear,
  children,
}: {
  selectedCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-fluid-xs font-medium text-slate-900">{selectedCount}건 선택</p>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            className="min-h-[2.75rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-fluid-xs text-gray-700 sm:flex-none sm:min-h-0"
            onClick={onClear}
          >
            선택 해제
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}

export function DbMarketplaceRowCard({
  row,
  onOpen,
  selectable,
  selected,
  onToggleSelect,
  bulkMode,
  showSeller,
  showMySalesMeta = false,
  showConfirmedMeta = false,
}: {
  row: DbMarketplaceMaskedItem;
  onOpen: () => void;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  bulkMode: DbMarketplaceBulkMode | null;
  showSeller: boolean;
  showMySalesMeta?: boolean;
  showConfirmedMeta?: boolean;
}) {
  const disabledReason =
    bulkMode && selectable ? marketplaceBulkSelectDisabledReason(row, bulkMode) : null;
  const canSelect = selectable && !disabledReason;
  const cleaningSummary = formatMarketplaceCleaningSummary(row);

  return (
    <div className="flex gap-1.5 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      {selectable ? (
        <label
          className={`relative z-[1] flex shrink-0 items-start justify-center touch-manipulation select-none ${
            canSelect ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
          }`}
          style={{
            width: 36,
            minWidth: 36,
            minHeight: 36,
          }}
          title={disabledReason ?? undefined}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-slate-900 touch-manipulation disabled:opacity-100"
            checked={selected}
            disabled={!canSelect}
            onChange={(e) => {
              e.stopPropagation();
              if (canSelect) onToggleSelect();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </label>
      ) : null}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:opacity-90 touch-manipulation">
        <div className="flex items-start justify-between gap-1.5">
          <p className="min-w-0 truncate text-fluid-xs font-semibold text-slate-900">{row.customerNameMasked}</p>
          <DbMarketplaceStatusBadge status={row.status} compact />
        </div>
        <p className="mt-0.5 truncate text-fluid-2xs text-gray-600" title={`${row.addressRegion} · ${cleaningSummary}`}>
          {row.addressRegion} · {cleaningSummary}
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-fluid-2xs text-gray-500">{formatMarketplaceSchedule(row)}</p>
          <div className="shrink-0 text-right">
            <p className="text-fluid-xs font-semibold tabular-nums text-slate-900">
              {formatWon(resolveMarketplaceCustomerBalance(row))}
            </p>
            <p className="text-fluid-2xs text-violet-800 tabular-nums">
              수수료 {formatWon(resolveMarketplaceBuyerTotalFee(row))}
            </p>
          </div>
        </div>
        {row.priorFeesTotal != null && row.priorFeesTotal > 0 ? (
          <p className="mt-0.5 text-fluid-2xs text-gray-500 tabular-nums">
            앞선 판매 {row.priorFeesTotal.toLocaleString('ko-KR')}원 포함
          </p>
        ) : null}
        {showSeller ? (
          <p className="mt-0.5 truncate text-fluid-2xs text-gray-500">{row.sellerTenantName}</p>
        ) : null}
        {showMySalesMeta ? (
          <div className="mt-1 space-y-0 text-fluid-2xs text-gray-600">
            <p className="truncate">
              판매 {formatMarketplaceListDate(row.publishedAt)} · 인계 {formatMarketplaceListDate(row.sellerConfirmedAt)}
            </p>
            <p className="truncate">업체 {row.buyerName ?? '-'}</p>
          </div>
        ) : null}
        {showConfirmedMeta ? (
          <div className="mt-1 space-y-0 text-fluid-2xs text-gray-600">
            <p className="truncate">
              {row.role === 'SELLER' ? '인계' : '구매'} · {formatMarketplaceListDate(row.sellerConfirmedAt)}
            </p>
            <p className="truncate">
              {row.role === 'SELLER' ? '인계 업체' : '판매 업체'}{' '}
              {row.role === 'SELLER' ? (row.buyerName ?? '-') : row.sellerTenantName}
            </p>
            <p className="tabular-nums text-violet-900">
              수수료 {formatWon(resolveMarketplaceBuyerTotalFee(row))}
            </p>
          </div>
        ) : null}
      </button>
    </div>
  );
}

/** 목록 하단 여백 — 고정 일괄 액션 바·모바일 브라우저 UI와 겹치지 않게 */
export function dbMarketplacePageBottomClass(hasBulkBar: boolean): string {
  return hasBulkBar ? 'pb-36 sm:pb-28' : 'pb-8 sm:pb-6';
}
