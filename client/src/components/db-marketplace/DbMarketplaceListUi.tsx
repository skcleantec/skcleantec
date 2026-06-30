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
    <div className="mt-3 border-b border-gray-100 pb-3 lg:hidden">
      <label className="flex min-h-11 cursor-pointer touch-manipulation select-none items-center gap-3">
        <MarketplaceBulkSelectCheckbox
          checked={allPageSelected}
          indeterminate={partialPageSelected}
          onChange={onToggleAllPage}
          aria-label={label}
          className="size-5 shrink-0 accent-slate-900"
        />
        <span className="text-fluid-xs font-medium text-slate-800">{label}</span>
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
        className="flex max-w-full flex-nowrap gap-1 overflow-x-auto overscroll-x-contain rounded-lg border border-gray-200 bg-white p-1 [scrollbar-width:thin]"
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
            className={`shrink-0 rounded-md px-3 py-2 text-fluid-xs font-medium transition-colors whitespace-nowrap ${
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
}: {
  row: DbMarketplaceMaskedItem;
  onOpen: () => void;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  bulkMode: DbMarketplaceBulkMode | null;
  showSeller: boolean;
  showMySalesMeta?: boolean;
}) {
  const disabledReason =
    bulkMode && selectable ? marketplaceBulkSelectDisabledReason(row, bulkMode) : null;
  const canSelect = selectable && !disabledReason;
  const cleaningSummary = formatMarketplaceCleaningSummary(row);

  return (
    <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {selectable ? (
        <label
          className={`relative z-[1] flex shrink-0 items-start justify-center touch-manipulation select-none ${
            canSelect ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
          }`}
          style={{
            width: MARKETPLACE_MOBILE_CHECKBOX_TOUCH_PX,
            minWidth: MARKETPLACE_MOBILE_CHECKBOX_TOUCH_PX,
            minHeight: MARKETPLACE_MOBILE_CHECKBOX_TOUCH_PX,
          }}
          title={disabledReason ?? undefined}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="mt-2.5 size-5 shrink-0 accent-slate-900 touch-manipulation disabled:opacity-100"
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-fluid-sm font-semibold text-slate-900 break-words">{row.customerNameMasked}</p>
            <p className="mt-0.5 text-fluid-xs text-gray-500">{row.addressRegion}</p>
            <p className="mt-1 text-fluid-xs text-gray-600 break-words">{cleaningSummary}</p>
            <p className="mt-1 text-fluid-xs text-gray-500">{formatMarketplaceSchedule(row)}</p>
            {row.listingFee != null ? (
              <p className="mt-1 text-fluid-xs text-gray-500 tabular-nums">
                수수료 {row.listingFee.toLocaleString('ko-KR')}원
              </p>
            ) : null}
            {showSeller ? (
              <p className="mt-1 text-[11px] text-gray-500 break-words sm:hidden">{row.sellerTenantName}</p>
            ) : null}
            {showMySalesMeta ? (
              <div className="mt-2 space-y-0.5 text-[11px] text-gray-600">
                <p>판매 {formatMarketplaceListDate(row.publishedAt)}</p>
                <p>인계 {formatMarketplaceListDate(row.sellerConfirmedAt)}</p>
                <p className="break-words">업체 {row.buyerName ?? '-'}</p>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
            <DbMarketplaceStatusBadge status={row.status} />
            <p className="text-fluid-sm font-semibold tabular-nums text-slate-900">
              {row.displayAmount != null ? `${row.displayAmount.toLocaleString('ko-KR')}원` : '-'}
            </p>
            {showSeller ? (
              <p className="hidden max-w-[8rem] truncate text-[11px] text-gray-500 sm:block" title={row.sellerTenantName}>
                {row.sellerTenantName}
              </p>
            ) : null}
          </div>
        </div>
      </button>
    </div>
  );
}

/** 목록 하단 여백 — 고정 일괄 액션 바·모바일 브라우저 UI와 겹치지 않게 */
export function dbMarketplacePageBottomClass(hasBulkBar: boolean): string {
  return hasBulkBar ? 'pb-36 sm:pb-28' : 'pb-8 sm:pb-6';
}
