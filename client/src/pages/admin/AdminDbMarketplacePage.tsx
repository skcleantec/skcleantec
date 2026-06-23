import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  bulkBuyerConfirmDbMarketplace,
  bulkPublishDbMarketplace,
  listDbMarketplace,
  getDbMarketplaceListing,
  type DbMarketplaceAudienceInput,
  type DbMarketplaceListTab,
  type DbMarketplaceMaskedItem,
} from '../../api/dbMarketplace';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { DbMarketplaceListingDetailModal } from '../../components/admin/DbMarketplaceListingDetailModal';
import { DbMarketplaceAudiencePickerModal } from '../../components/admin/DbMarketplaceAudiencePickerModal';
import { DbMarketplaceBulkResultModal } from '../../components/admin/DbMarketplaceBulkResultModal';
import {
  DbMarketplaceBulkActionBar,
  DbMarketplaceRowCard,
  DbMarketplaceTabBar,
  dbMarketplacePageBottomClass,
} from '../../components/db-marketplace/DbMarketplaceListUi';
import {
  formatMarketplaceCleaningSummary,
  formatMarketplaceSchedule,
} from '../../utils/dbMarketplaceDisplay';
import {
  canBulkBuyMarketplaceItem,
  canBulkPublishMarketplaceItem,
  marketplaceBulkSelectDisabledReason,
} from '../../utils/dbMarketplaceBulk';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { DB_MARKETPLACE_BULK_MAX } from '@shared/dbMarketplacePolicy';

const TAB_OPTIONS: { id: DbMarketplaceListTab; label: string }[] = [
  { id: 'cart', label: '장바구니' },
  { id: 'available', label: '구매 가능' },
  { id: 'my_sales', label: '내 판매' },
  { id: 'pending', label: '진행 중' },
  { id: 'confirmed', label: '확정 완료' },
];

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

function parseAdminTab(raw: string | null): DbMarketplaceListTab {
  if (raw === 'cart' || raw === 'available' || raw === 'my_sales' || raw === 'pending' || raw === 'confirmed') {
    return raw;
  }
  return 'available';
}

function cleaningSummary(row: DbMarketplaceMaskedItem): string {
  return formatMarketplaceCleaningSummary(row);
}

export function AdminDbMarketplacePage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseAdminTab(searchParams.get('tab'));
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const [items, setItems] = useState<DbMarketplaceMaskedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<DbMarketplaceMaskedItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    title: string;
    successLabel: string;
    successCount: number;
    failed: Array<{ id: string; error: string }>;
  } | null>(null);

  const bulkMode = tab === 'cart' ? 'publish' : tab === 'available' ? 'buy' : null;
  const selectable = bulkMode != null;
  const showSellerColumn = tab !== 'cart';

  const offset = (page - 1) * pageSize;

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      void listDbMarketplace(token, { tab, limit: pageSize, offset })
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [token, tab, pageSize, offset],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, page, pageSize]);

  const openListingId = searchParams.get('openListing')?.trim() ?? '';

  const clearOpenListingParam = useCallback(() => {
    if (!searchParams.get('openListing')) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('openListing');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!token || !openListingId) return;
    void getDbMarketplaceListing(token, openListingId)
      .then((item) => setSelectedRow(item))
      .catch(() => {});
  }, [token, openListingId]);

  const lastSilentRefreshRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 4000) return;
    lastSilentRefreshRef.current = now;
    load({ silent: true });
  }, [load]);

  const { connected: wsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !wsConnected ? 20000 : 0);

  const setTab = (next: DbMarketplaceListTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    nextParams.set('page', '1');
    setSearchParams(nextParams, { replace: true });
  };

  const onPageChange = (nextPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(clampListPage(nextPage, pageSize, total)));
    setSearchParams(nextParams, { replace: true });
  };

  const onPageSizeChange = (nextSize: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('pageSize', String(nextSize));
    nextParams.set('page', '1');
    setSearchParams(nextParams, { replace: true });
  };

  const tabLabel = useMemo(() => TAB_OPTIONS.find((t) => t.id === tab)?.label ?? '', [tab]);

  const canSelectRow = useCallback(
    (row: DbMarketplaceMaskedItem) => {
      if (bulkMode === 'publish') return canBulkPublishMarketplaceItem(row);
      if (bulkMode === 'buy') return canBulkBuyMarketplaceItem(row);
      return false;
    },
    [bulkMode],
  );

  const selectableOnPage = useMemo(() => items.filter(canSelectRow), [items, canSelectRow]);
  const allPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((r) => selectedIds.has(r.id));

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of selectableOnPage) next.delete(r.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of selectableOnPage) next.add(r.id);
        return next;
      });
    }
  };

  const selectedCount = selectedIds.size;

  const runBulkPublish = async (value: {
    visibility: 'ALL' | 'SELECTED';
    audiences: DbMarketplaceAudienceInput[];
  }) => {
    if (!token || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 게시할 수 있습니다.`);
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkPublishDbMarketplace(token, {
        listingIds: [...selectedIds],
        visibility: value.visibility,
        audiences: value.audiences,
      });
      setAudienceModalOpen(false);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 게시 결과',
        successLabel: '게시 완료',
        successCount: result.published.length,
        failed: result.failed,
      });
      load({ silent: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 게시 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkBuy = async () => {
    if (!token || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 신청할 수 있습니다.`);
      return;
    }
    if (
      !window.confirm(
        `선택 ${selectedCount}건에 구매를 신청(갖고가기)합니다. 판매자 인계 확정 후 전체 DB가 공개됩니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkBuyerConfirmDbMarketplace(token, [...selectedIds]);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 갖고가기 결과',
        successLabel: '구매 신청 완료',
        successCount: result.requested.length,
        failed: result.failed,
      });
      load({ silent: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 갖고가기 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className={`min-w-0 w-full max-w-full space-y-4 ${dbMarketplacePageBottomClass(selectedCount > 0 && selectable)}`}>
      <div>
        <h1 className="text-fluid-lg font-semibold text-slate-900">정보공유</h1>
        <p className="mt-1 text-fluid-xs text-gray-600">
          {tab === 'cart'
            ? '장바구니에 담은 DB를 선택해 노출 업체를 지정하고 한 번에 게시할 수 있습니다.'
            : '구매 전에는 시·구 주소와 표시금액(잔금−수수료)만 노출됩니다. 확정 후 전체 DB가 공개됩니다.'}
        </p>
      </div>

      <DbMarketplaceTabBar options={TAB_OPTIONS} active={tab} onChange={setTab} />

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />

        {error ? <p className="mt-4 text-fluid-sm text-red-600">{error}</p> : null}

        {loading && items.length === 0 ? (
          <p className="mt-6 p-8 text-center text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="mt-6 p-8 text-center text-fluid-sm text-gray-500">{tabLabel} 항목이 없습니다.</p>
        ) : null}

        <div className="mt-4 hidden lg:block overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full table-fixed border-collapse text-fluid-xs min-w-[720px]">
            <colgroup>
              {selectable ? <col className="w-[36px]" /> : null}
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              {tab === 'cart' ? <col className="w-[10%]" /> : null}
              <col className="w-[10%]" />
              {showSellerColumn ? <col className="w-[12%]" /> : null}
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                {selectable ? (
                  <th className="px-1 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label="현재 페이지 전체 선택"
                      checked={allPageSelected}
                      onChange={toggleAllPage}
                      disabled={selectableOnPage.length === 0}
                    />
                  </th>
                ) : null}
                <th className="px-2 py-2 text-center">고객</th>
                <th className="px-2 py-2 text-center">지역</th>
                <th className="px-2 py-2 text-center">청소 요약</th>
                <th className="px-2 py-2 text-center">일정</th>
                {tab === 'cart' ? <th className="px-2 py-2 text-center">수수료</th> : null}
                <th className="px-2 py-2 text-center">표시금액</th>
                {showSellerColumn ? <th className="px-2 py-2 text-center">판매 업체</th> : null}
                <th className="px-2 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const canSelect = canSelectRow(row);
                const disabledReason =
                  bulkMode && selectable ? marketplaceBulkSelectDisabledReason(row, bulkMode) : null;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedRow(row)}
                  >
                    {selectable ? (
                      <td className="px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          disabled={!canSelect}
                          title={disabledReason ?? undefined}
                          onChange={() => {
                            if (canSelect) toggleRow(row.id);
                          }}
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-center truncate" title={row.customerNameMasked}>
                      {row.customerNameMasked}
                    </td>
                    <td className="px-2 py-2 text-center truncate" title={row.addressRegion}>
                      {row.addressRegion}
                    </td>
                    <td className="px-2 py-2 text-center truncate" title={cleaningSummary(row)}>
                      {cleaningSummary(row)}
                    </td>
                    <td className="px-2 py-2 text-center">{formatMarketplaceSchedule(row)}</td>
                    {tab === 'cart' ? (
                      <td className="px-2 py-2 text-right tabular-nums">
                        {row.listingFee != null ? `${row.listingFee.toLocaleString('ko-KR')}원` : '-'}
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.displayAmount != null ? `${row.displayAmount.toLocaleString('ko-KR')}원` : '-'}
                    </td>
                    {showSellerColumn ? (
                      <td className="px-2 py-2 text-center truncate" title={row.sellerTenantName}>
                        {row.sellerTenantName}
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLASS[row.status] ?? ''}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-3 lg:hidden">
          {items.map((row) => (
            <DbMarketplaceRowCard
              key={row.id}
              row={row}
              onOpen={() => setSelectedRow(row)}
              selectable={selectable}
              selected={selectedIds.has(row.id)}
              onToggleSelect={() => toggleRow(row.id)}
              bulkMode={bulkMode}
              showSeller={showSellerColumn}
            />
          ))}
        </div>

        {!loading ? (
          <ListPaginationBar
            mode="nav"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </div>

      {bulkMode ? (
        <DbMarketplaceBulkActionBar selectedCount={selectedCount} onClear={() => setSelectedIds(new Set())}>
        {bulkMode === 'publish' ? (
          <button
            type="button"
            disabled={bulkBusy}
            className="min-h-[2.75rem] flex-1 rounded-lg bg-violet-700 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50 sm:min-h-0 sm:flex-none sm:px-4"
            onClick={() => setAudienceModalOpen(true)}
          >
            <span className="sm:hidden">노출 지정 · 게시</span>
            <span className="hidden sm:inline">노출 업체 지정 · 게시하기</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={bulkBusy}
            className="min-h-[2.75rem] flex-1 rounded-lg bg-violet-700 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50 sm:min-h-0 sm:flex-none"
            onClick={() => void runBulkBuy()}
          >
            갖고가기
          </button>
        )}
      </DbMarketplaceBulkActionBar>
      ) : null}

      <DbMarketplaceAudiencePickerModal
        open={audienceModalOpen}
        onClose={() => setAudienceModalOpen(false)}
        busy={bulkBusy}
        title="일괄 노출 대상"
        description={`선택 ${selectedCount}건에 동일한 노출 업체를 적용한 뒤 게시합니다.`}
        confirmLabel="게시하기"
        onConfirm={runBulkPublish}
      />

      <DbMarketplaceBulkResultModal
        open={bulkResult != null}
        onClose={() => setBulkResult(null)}
        title={bulkResult?.title ?? ''}
        successLabel={bulkResult?.successLabel ?? ''}
        successCount={bulkResult?.successCount ?? 0}
        failed={bulkResult?.failed ?? []}
      />

      {selectedRow ? (
        <DbMarketplaceListingDetailModal
          row={selectedRow}
          onClose={() => {
            setSelectedRow(null);
            clearOpenListingParam();
          }}
          onChanged={() => load({ silent: true })}
        />
      ) : null}
    </div>
  );
}
