import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import {
  bulkTeamBuyerConfirmDbMarketplace,
  bulkTeamBuyerDeclineDbMarketplace,
  listTeamDbMarketplace,
  getTeamDbMarketplaceListing,
  type DbMarketplaceMaskedItem,
  type TeamDbMarketplaceListTab,
} from '../../api/dbMarketplace';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { DbMarketplaceListingDetailModal } from '../../components/admin/DbMarketplaceListingDetailModal';
import { DbMarketplaceBulkResultModal } from '../../components/admin/DbMarketplaceBulkResultModal';
import {
  DbMarketplaceBulkActionBar,
  DbMarketplaceRowCard,
  DbMarketplaceTabBar,
  MarketplaceTableCheckboxCol,
  MarketplaceBulkSelectCheckbox,
  DbMarketplaceMobilePageSelectBar,
  dbMarketplacePageBottomClass,
  marketplaceTableCheckboxCellProps,
} from '../../components/db-marketplace/DbMarketplaceListUi';
import {
  DbMarketplaceBuyBulkButton,
  DbMarketplaceBuyerDeclineBulkButton,
} from '../../components/db-marketplace/marketplaceUiParts';
import {
  formatMarketplaceCleaningSummary,
  formatMarketplaceSchedule,
} from '../../utils/dbMarketplaceDisplay';
import {
  formatWon,
  resolveMarketplaceBuyerTotalFee,
  resolveMarketplaceServiceBalance,
  resolveMarketplaceServiceTotal,
} from '../../components/db-marketplace/DbMarketplaceAmountSummary';
import {
  canBulkBuyMarketplaceItem,
  canBuyerDeclinePriorityMarketplaceItem,
} from '../../utils/dbMarketplaceBulk';
import { DB_MARKETPLACE_BULK_MAX } from '@shared/dbMarketplacePolicy';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';

const TAB_OPTIONS: { id: TeamDbMarketplaceListTab; label: string }[] = [
  { id: 'available', label: '구매 가능' },
  { id: 'pending', label: '인계 대기' },
  { id: 'confirmed', label: '확정 완료' },
];

const STATUS_LABEL: Record<string, string> = {
  OPEN: '게시 중',
  PENDING_SELLER: '인계 대기',
  CONFIRMED: '확정 완료',
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-sky-100 text-sky-800',
  PENDING_SELLER: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
};

function parseTeamTab(raw: string | null): TeamDbMarketplaceListTab {
  if (raw === 'pending' || raw === 'confirmed') return raw;
  return 'available';
}

function cleaningSummary(row: DbMarketplaceMaskedItem): string {
  return formatMarketplaceCleaningSummary(row);
}

export function TeamDbMarketplacePage() {
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTeamTab(searchParams.get('tab'));
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const [items, setItems] = useState<DbMarketplaceMaskedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<DbMarketplaceMaskedItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    title: string;
    successLabel: string;
    successCount: number;
    failed: Array<{ id: string; error: string }>;
  } | null>(null);

  const selectable = tab === 'available';

  const offset = (page - 1) * pageSize;

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!teamToken) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      void listTeamDbMarketplace(teamToken, { tab, limit: pageSize, offset })
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [teamToken, tab, pageSize, offset],
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
    if (!teamToken || !openListingId) return;
    void getTeamDbMarketplaceListing(teamToken, openListingId)
      .then((item) => setSelectedRow(item))
      .catch(() => {});
  }, [teamToken, openListingId]);

  const lastSilentRefreshRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 4000) return;
    lastSilentRefreshRef.current = now;
    load({ silent: true });
  }, [load]);

  const { connected: wsConnected } = useInboxRealtime(teamToken, silentRefresh, Boolean(teamToken));
  useVisibilityInterval(silentRefresh, teamToken && !wsConnected ? 20000 : 0);

  const setTab = (next: TeamDbMarketplaceListTab) => {
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

  const selectableOnPage = useMemo(() => items.filter(canBulkBuyMarketplaceItem), [items]);
  const allPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((r) => selectedIds.has(r.id));
  const selectedOnPageCount = useMemo(
    () => selectableOnPage.filter((r) => selectedIds.has(r.id)).length,
    [selectableOnPage, selectedIds],
  );
  const partialPageSelected = selectedOnPageCount > 0 && !allPageSelected;
  const selectedCount = selectedIds.size;

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

  const runBulkBuy = async () => {
    if (!teamToken || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 신청할 수 있습니다.`);
      return;
    }
    if (
      !window.confirm(
        `선택 ${selectedCount}건에 구매를 신청(갖고가기)합니다. 발주 업체 인계 확정 후 전체 DB가 공개됩니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkTeamBuyerConfirmDbMarketplace(teamToken, [...selectedIds]);
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

  const runBulkBuyerDecline = async () => {
    if (!teamToken || selectedCount === 0) return;
    const listingIds = items
      .filter((r) => selectedIds.has(r.id) && canBuyerDeclinePriorityMarketplaceItem(r))
      .map((r) => r.id);
    if (listingIds.length === 0) {
      alert('순위 노출 DB만 거절할 수 있습니다.');
      return;
    }
    if (listingIds.length > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 처리할 수 있습니다.`);
      return;
    }
    if (
      !window.confirm(
        `선택 ${listingIds.length}건을 거절할까요?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkTeamBuyerDeclineDbMarketplace(teamToken, listingIds);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 거절 결과',
        successLabel: '거절 완료',
        successCount: result.declined.length,
        failed: result.failed,
      });
      load({ silent: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 거절 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className={`min-w-0 w-full max-w-full space-y-2 sm:space-y-4 ${dbMarketplacePageBottomClass(selectedCount > 0 && selectable)}`}>
      <DbMarketplaceTabBar options={TAB_OPTIONS} active={tab} onChange={setTab} />

      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-4">
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />

        {error ? <p className="mt-2 text-fluid-2xs text-red-600 sm:mt-4 sm:text-fluid-sm">{error}</p> : null}

        {loading && items.length === 0 ? (
          <p className="mt-4 p-6 text-center text-fluid-2xs text-gray-500 sm:mt-6 sm:p-8 sm:text-fluid-sm">불러오는 중…</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="mt-4 p-6 text-center text-fluid-2xs text-gray-500 sm:mt-6 sm:p-8 sm:text-fluid-sm">
            {tabLabel} 항목이 없습니다.
          </p>
        ) : null}

        <div className="mt-2 hidden lg:block overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mt-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full table-fixed border-collapse text-fluid-xs min-w-[760px]">
            <colgroup>
              {selectable ? <MarketplaceTableCheckboxCol /> : null}
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                {selectable ? (
                  <th {...marketplaceTableCheckboxCellProps()}>
                    <MarketplaceBulkSelectCheckbox
                      checked={allPageSelected}
                      indeterminate={partialPageSelected}
                      onChange={toggleAllPage}
                      disabled={selectableOnPage.length === 0}
                      aria-label="현재 페이지 전체 선택"
                    />
                  </th>
                ) : null}
                <th className="px-2 py-2 text-center">고객</th>
                <th className="px-2 py-2 text-center">지역</th>
                <th className="px-2 py-2 text-center">청소 요약</th>
                <th className="px-2 py-2 text-center">일정</th>
                <th className="px-2 py-2 text-center">총액</th>
                <th className="px-2 py-2 text-center">수수료</th>
                <th className="px-2 py-2 text-center">잔금</th>
                <th className="px-2 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const canSelect = canBulkBuyMarketplaceItem(row);
                return (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedRow(row)}
                >
                  {selectable ? (
                    <td {...marketplaceTableCheckboxCellProps()} onClick={(e) => e.stopPropagation()}>
                      <MarketplaceBulkSelectCheckbox
                        checked={selectedIds.has(row.id)}
                        disabled={!canSelect}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`${row.customerNameMasked} 선택`}
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
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatWon(resolveMarketplaceServiceTotal(row))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-violet-900">
                    {formatWon(resolveMarketplaceBuyerTotalFee(row))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatWon(resolveMarketplaceServiceBalance(row))}
                  </td>
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

        <DbMarketplaceMobilePageSelectBar
          selectable={selectable}
          selectableOnPageCount={selectableOnPage.length}
          allPageSelected={allPageSelected}
          partialPageSelected={partialPageSelected}
          onToggleAllPage={toggleAllPage}
        />

        <div className="mt-2 space-y-1.5 lg:hidden sm:mt-4 sm:space-y-3">
          {items.map((row) => (
            <DbMarketplaceRowCard
              key={row.id}
              row={row}
              onOpen={() => setSelectedRow(row)}
              selectable={selectable}
              selected={selectedIds.has(row.id)}
              onToggleSelect={() => toggleRow(row.id)}
              bulkMode={selectable ? 'buy' : null}
              showSeller={false}
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

      {selectable ? (
        <DbMarketplaceBulkActionBar selectedCount={selectedCount} onClear={() => setSelectedIds(new Set())}>
          <DbMarketplaceBuyBulkButton disabled={bulkBusy} onClick={() => void runBulkBuy()} />
          <DbMarketplaceBuyerDeclineBulkButton
            disabled={bulkBusy}
            onClick={() => void runBulkBuyerDecline()}
          />
        </DbMarketplaceBulkActionBar>
      ) : null}

      <DbMarketplaceBulkResultModal
        open={bulkResult != null}
        onClose={() => setBulkResult(null)}
        title={bulkResult?.title ?? ''}
        successLabel={bulkResult?.successLabel ?? ''}
        successCount={bulkResult?.successCount ?? 0}
        failed={bulkResult?.failed ?? []}
      />

      {selectedRow && teamToken ? (
        <DbMarketplaceListingDetailModal
          row={selectedRow}
          apiMode="team"
          token={teamToken}
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
