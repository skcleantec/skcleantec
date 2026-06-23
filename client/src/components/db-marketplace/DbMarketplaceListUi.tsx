import type { ReactNode } from 'react';
import type { DbMarketplaceMaskedItem } from '../../api/dbMarketplace';
import {
  formatMarketplaceCleaningSummary,
  formatMarketplaceSchedule,
} from '../../utils/dbMarketplaceDisplay';
import { marketplaceBulkSelectDisabledReason } from '../../utils/dbMarketplaceBulk';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '장바구니',
  OPEN: '게시 중',
  PENDING_SELLER: '인계 대기',
  CONFIRMED: '확정 완료',
  WITHDRAWN: '철회',
  EXPIRED: '만료',
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  OPEN: 'bg-sky-100 text-sky-800',
  PENDING_SELLER: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  WITHDRAWN: 'bg-gray-200 text-gray-600',
  EXPIRED: 'bg-gray-100 text-gray-700',
};

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
        <div className="flex w-full gap-2 sm:w-auto">
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
}: {
  row: DbMarketplaceMaskedItem;
  onOpen: () => void;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  bulkMode: 'publish' | 'buy' | null;
  showSeller: boolean;
}) {
  const disabledReason =
    bulkMode && selectable ? marketplaceBulkSelectDisabledReason(row, bulkMode) : null;
  const canSelect = selectable && !disabledReason;
  const cleaningSummary = formatMarketplaceCleaningSummary(row);

  return (
    <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {selectable ? (
        <label className="flex shrink-0 items-start pt-0.5">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={selected}
            disabled={!canSelect}
            title={disabledReason ?? undefined}
            onChange={(e) => {
              e.stopPropagation();
              if (canSelect) onToggleSelect();
            }}
          />
        </label>
      ) : null}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:opacity-90">
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
          </div>
          <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[row.status] ?? ''}`}
            >
              {STATUS_LABEL[row.status] ?? row.status}
            </span>
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
