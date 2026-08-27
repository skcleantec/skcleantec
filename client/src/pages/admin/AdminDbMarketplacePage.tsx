import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  bulkBuyerConfirmDbMarketplace,
  bulkBuyerDeclineDbMarketplace,
  bulkPublishDbMarketplace,
  bulkSellerConfirmDbMarketplace,
  bulkSellerDeclineDbMarketplace,
  bulkRemoveFromCartDbMarketplace,
  bulkRevertToCartDbMarketplace,
  listDbMarketplace,
  getDbMarketplaceListing,
  getDbMarketplaceNavCounts,
  listDbMarketplaceAudienceOptions,
  type DbMarketplaceAudienceInput,
  type DbMarketplaceOfferMode,
  type DbMarketplaceMaskedItem,
} from '../../api/dbMarketplace';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { DbMarketplaceHelpModal } from '../../components/admin/db-marketplace-help/DbMarketplaceHelpModal';
import { DbMarketplaceHelpTrigger } from '../../components/admin/db-marketplace-help/DbMarketplaceHelpTrigger';
import { DbMarketplaceListingDetailModal } from '../../components/admin/DbMarketplaceListingDetailModal';
import { DbMarketplaceAudiencePickerModal } from '../../components/admin/DbMarketplaceAudiencePickerModal';
import { DbMarketplaceBulkResultModal } from '../../components/admin/DbMarketplaceBulkResultModal';
import {
  DbMarketplaceBulkActionBar,
  DbMarketplaceRowCard,
  DbMarketplaceTabBar,
  DbMarketplaceSideSegment,
  DbMarketplaceHintBanner,
  DbMarketplaceLegalNotice,
  MarketplaceTableCheckboxCol,
  MarketplaceBulkSelectCheckbox,
  DbMarketplaceMobilePageSelectBar,
  dbMarketplacePageBottomClass,
  marketplaceTableCheckboxCellProps,
} from '../../components/db-marketplace/DbMarketplaceListUi';
import {
  DbMarketplaceBuyBulkButton,
  DbMarketplaceBuyerDeclineBulkButton,
  DbMarketplaceConfirmBulkButton,
  DbMarketplaceDeclineBulkButton,
  DbMarketplacePublishBulkButton,
  DbMarketplaceRevertBulkButton,
  DbMarketplaceRevertToCartButton,
  MARKETPLACE_STATUS_CLASS,
  MARKETPLACE_STATUS_LABEL,
} from '../../components/db-marketplace/marketplaceUiParts';
import {
  DbMarketplaceMySalesFilters,
  applyMySalesFiltersToSearchParams,
  mySalesFiltersToApiParams,
  parseMySalesFiltersFromSearchParams,
  type DbMarketplaceMySalesFilterState,
} from '../../components/db-marketplace/DbMarketplaceMySalesFilters';
import {
  formatMarketplaceCleaningSummary,
  formatMarketplaceSchedule,
  formatMarketplaceListDate,
} from '../../utils/dbMarketplaceDisplay';
import {
  formatWon,
  resolveMarketplaceBuyerTotalFee,
  resolveMarketplaceServiceBalance,
  resolveMarketplaceServiceTotal,
} from '../../components/db-marketplace/DbMarketplaceAmountSummary';
import {
  canBulkSelectMarketplaceItem,
  canBuyerDeclinePriorityMarketplaceItem,
  groupMySalesByCompany,
  type DbMarketplaceBulkMode,
} from '../../utils/dbMarketplaceBulk';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { DB_MARKETPLACE_BULK_MAX } from '@shared/dbMarketplacePolicy';
import {
  adminTabUsesListFilters,
  adminUiTabToApiTab,
  legacyAdminTabToNav,
  marketplaceAdminTabsForSide,
  marketplaceEmptyTitle,
  marketplaceHintForAdminTab,
  MARKETPLACE_SIDE_OPTIONS,
  MARKETPLACE_LEGAL_NOTICE,
  parseMarketplaceAdminUiTab,
  parseMarketplaceSide,
  type MarketplaceAdminUiTab,
  type MarketplaceSide,
} from '../../utils/dbMarketplaceNav';

function cleaningSummary(row: DbMarketplaceMaskedItem): string {
  return formatMarketplaceCleaningSummary(row);
}

export function AdminDbMarketplacePage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useMemo(() => {
    const legacy = legacyAdminTabToNav(searchParams.get('tab'));
    if (legacy && !searchParams.get('side')) {
      return { ...legacy, needsLegacyRedirect: true as const };
    }
    const side = parseMarketplaceSide(searchParams.get('side'));
    const uiTab = parseMarketplaceAdminUiTab(side, searchParams.get('tab'));
    return { side, uiTab, needsLegacyRedirect: false as const };
  }, [searchParams]);
  const { side, uiTab } = nav;
  const apiTab = adminUiTabToApiTab(side, uiTab);
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  useEffect(() => {
    if (!nav.needsLegacyRedirect) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('side', nav.side);
    nextParams.set('tab', nav.uiTab);
    setSearchParams(nextParams, { replace: true });
  }, [nav, searchParams, setSearchParams]);

  const [items, setItems] = useState<DbMarketplaceMaskedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerPendingCount, setSellerPendingCount] = useState(0);
  const [buyerPendingCount, setBuyerPendingCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [selectedRow, setSelectedRow] = useState<DbMarketplaceMaskedItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [marketplaceHelpOpen, setMarketplaceHelpOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    title: string;
    successLabel: string;
    successCount: number;
    failed: Array<{ id: string; error: string }>;
  } | null>(null);

  const bulkMode: DbMarketplaceBulkMode | null =
    apiTab === 'cart'
      ? 'publish'
      : apiTab === 'available'
        ? 'buy'
        : apiTab === 'share_open'
          ? 'revert_cart'
          : apiTab === 'pending_out'
            ? 'seller_confirm'
            : null;
  const selectable = bulkMode != null;
  const showSellerColumn = apiTab === 'available' || apiTab === 'pending_in' || apiTab === 'confirmed_receive';
  const showMySalesMeta = apiTab === 'share_open';
  const showConfirmedMeta = apiTab === 'confirmed_share' || apiTab === 'confirmed_receive';
  const showPendingMeta = apiTab === 'pending_out' || apiTab === 'pending_in';
  const showListFilters = adminTabUsesListFilters(apiTab);
  const compactAmountMobile = side === 'receive';
  const mySalesFilters = useMemo(
    () => parseMySalesFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  const displayGroups = useMemo(() => {
    if (showListFilters && mySalesFilters.groupByCompany && apiTab !== 'cart') {
      return groupMySalesByCompany(items);
    }
    return [{ label: null as string | null, items }];
  }, [items, showListFilters, mySalesFilters.groupByCompany, apiTab]);

  const tableColSpan = useMemo(() => {
    let n = 4;
    if (selectable) n += 1;
    n += 3;
    if (showMySalesMeta) n += 3;
    if (showConfirmedMeta) n += 2;
    if (showPendingMeta) n += 1;
    if (showSellerColumn) n += 1;
    n += 1;
    return n;
  }, [selectable, showMySalesMeta, showConfirmedMeta, showPendingMeta, showSellerColumn]);

  const [audiencePartners, setAudiencePartners] = useState<
    Awaited<ReturnType<typeof listDbMarketplaceAudienceOptions>>['partners']
  >([]);
  const [audienceExternals, setAudienceExternals] = useState<
    Awaited<ReturnType<typeof listDbMarketplaceAudienceOptions>>['externalCompanies']
  >([]);

  useEffect(() => {
    if (!token || !showListFilters) return;
    void listDbMarketplaceAudienceOptions(token)
      .then((r) => {
        setAudiencePartners(r.partners);
        setAudienceExternals(r.externalCompanies);
      })
      .catch(() => {});
  }, [token, showListFilters]);

  const offset = (page - 1) * pageSize;

  const loadNavCounts = useCallback(() => {
    if (!token) return;
    void getDbMarketplaceNavCounts(token)
      .then(({ sellerPendingCount: seller, buyerPendingCount: buyer, draftCount: draft }) => {
        setSellerPendingCount(seller);
        setBuyerPendingCount(buyer);
        setDraftCount(draft);
      })
      .catch(() => {});
  }, [token]);

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      void listDbMarketplace(token, {
        tab: apiTab,
        limit: pageSize,
        offset,
        ...(showListFilters ? mySalesFiltersToApiParams(mySalesFilters) : {}),
      })
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [token, apiTab, pageSize, offset, showListFilters, mySalesFilters],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadNavCounts();
  }, [loadNavCounts]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [apiTab, page, pageSize]);

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
    loadNavCounts();
  }, [load, loadNavCounts]);

  const { connected: wsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !wsConnected ? 20000 : 0);

  const setSide = (next: MarketplaceSide) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('side', next);
    const defaultTab: MarketplaceAdminUiTab = next === 'share' ? 'draft' : 'browse';
    nextParams.set('tab', defaultTab);
    nextParams.set('page', '1');
    setSearchParams(nextParams, { replace: true });
  };

  const setUiTab = (next: MarketplaceAdminUiTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('side', side);
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

  const onMySalesFiltersChange = (next: DbMarketplaceMySalesFilterState) => {
    const nextParams = applyMySalesFiltersToSearchParams(searchParams, next);
    nextParams.set('page', '1');
    setSearchParams(nextParams, { replace: true });
  };

  const sideOptionsWithBadges = useMemo(
    () =>
      MARKETPLACE_SIDE_OPTIONS.map((opt) => {
        if (opt.id === 'share') {
          const badge = draftCount + sellerPendingCount;
          return badge > 0 ? { ...opt, badge } : opt;
        }
        const badge = buyerPendingCount;
        return badge > 0 ? { ...opt, badge } : opt;
      }),
    [draftCount, sellerPendingCount, buyerPendingCount],
  );

  const tabOptionsWithBadges = useMemo(
    () =>
      marketplaceAdminTabsForSide(side).map((opt) => {
        if (side === 'share' && opt.id === 'pending' && sellerPendingCount > 0) {
          return { ...opt, badge: sellerPendingCount };
        }
        if (side === 'receive' && opt.id === 'pending' && buyerPendingCount > 0) {
          return { ...opt, badge: buyerPendingCount };
        }
        if (side === 'share' && opt.id === 'draft' && draftCount > 0) {
          return { ...opt, badge: draftCount };
        }
        return opt;
      }),
    [side, sellerPendingCount, buyerPendingCount, draftCount],
  );

  const hintText = marketplaceHintForAdminTab(side, uiTab);
  const emptyTitle = marketplaceEmptyTitle(side, uiTab);

  const refreshAfterChange = useCallback(() => {
    load({ silent: true });
    loadNavCounts();
  }, [load, loadNavCounts]);

  const canSelectRow = useCallback(
    (row: DbMarketplaceMaskedItem) => {
      if (!bulkMode) return false;
      return canBulkSelectMarketplaceItem(row, bulkMode);
    },
    [bulkMode],
  );

  const selectableOnPage = useMemo(() => items.filter(canSelectRow), [items, canSelectRow]);
  const allPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((r) => selectedIds.has(r.id));
  const selectedOnPageCount = useMemo(
    () => selectableOnPage.filter((r) => selectedIds.has(r.id)).length,
    [selectableOnPage, selectedIds],
  );
  const partialPageSelected = selectedOnPageCount > 0 && !allPageSelected;

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
    offerMode?: DbMarketplaceOfferMode | null;
    audiences: DbMarketplaceAudienceInput[];
  }) => {
    if (!token || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 공유할 수 있습니다.`);
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkPublishDbMarketplace(token, {
        listingIds: [...selectedIds],
        visibility: value.visibility,
        offerMode: value.offerMode,
        audiences: value.audiences,
      });
      setAudienceModalOpen(false);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 공유 결과',
        successLabel: '공유 완료',
        successCount: result.published.length,
        failed: result.failed,
      });
      refreshAfterChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 공유 실패');
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
        `선택 ${selectedCount}건에 인수를 신청합니다. 상대 업체가 인계 확정하면 연락처 등 전체 정보가 공개됩니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkBuyerConfirmDbMarketplace(token, [...selectedIds]);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 인수 신청 결과',
        successLabel: '인수 신청 완료',
        successCount: result.requested.length,
        failed: result.failed,
      });
      refreshAfterChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 인수 신청 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkBuyerDecline = async () => {
    if (!token || selectedCount === 0) return;
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
      const result = await bulkBuyerDeclineDbMarketplace(token, listingIds);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 거절 결과',
        successLabel: '거절 완료',
        successCount: result.declined.length,
        failed: result.failed,
      });
      refreshAfterChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 거절 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkRemoveFromCart = async () => {
    if (!token || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 처리할 수 있습니다.`);
      return;
    }
    if (
      !window.confirm(
        `선택 ${selectedCount}건을 정보공유에서 제거하고 접수를 원상복귀합니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkRemoveFromCartDbMarketplace(token, [...selectedIds]);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 원상복귀 결과',
        successLabel: '원상복귀 완료',
        successCount: result.removed.length,
        failed: result.failed,
      });
      refreshAfterChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 원상복귀 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkRevertToCart = async () => {
    if (!token || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 처리할 수 있습니다.`);
      return;
    }
    if (
      !window.confirm(
        `선택 ${selectedCount}건을 공유 중에서 공유 준비로 되돌립니다. 노출 업체 설정은 유지됩니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkRevertToCartDbMarketplace(token, [...selectedIds]);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 공유 준비 되돌리기 결과',
        successLabel: '공유 준비 이동 완료',
        successCount: result.reverted.length,
        failed: result.failed,
      });
      refreshAfterChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 공유 준비 되돌리기 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkSellerConfirm = async () => {
    if (!token || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 처리할 수 있습니다.`);
      return;
    }
    if (
      !window.confirm(
        `선택 ${selectedCount}건을 인수 업체에 인계 확정합니다. 확정 후 취소·환불할 수 없습니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkSellerConfirmDbMarketplace(token, [...selectedIds]);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 인계 확정 결과',
        successLabel: '인계 확정 완료',
        successCount: result.confirmed.length,
        failed: result.failed,
      });
      refreshAfterChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 인계 확정 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkSellerDecline = async () => {
    if (!token || selectedCount === 0) return;
    if (selectedCount > DB_MARKETPLACE_BULK_MAX) {
      alert(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 처리할 수 있습니다.`);
      return;
    }
    if (
      !window.confirm(`선택 ${selectedCount}건의 인수 신청을 거절하고 다시 공유 중 상태로 되돌릴까요?`)
    ) {
      return;
    }
    setBulkBusy(true);
    try {
      const result = await bulkSellerDeclineDbMarketplace(token, [...selectedIds]);
      setSelectedIds(new Set());
      setBulkResult({
        title: '일괄 인수 신청 거절 결과',
        successLabel: '거절 완료',
        successCount: result.declined.length,
        failed: result.failed,
      });
      refreshAfterChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : '일괄 거절 실패');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className={`min-w-0 w-full max-w-full space-y-2 sm:space-y-4 ${dbMarketplacePageBottomClass(selectedCount > 0 && selectable)}`}>
      <div className="space-y-2">
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          <PageTitleWithFavorite label="정보공유">
            <h1 className="text-fluid-lg font-semibold text-slate-900">정보공유</h1>
          </PageTitleWithFavorite>
          <DbMarketplaceHelpTrigger className="shrink-0" onClick={() => setMarketplaceHelpOpen(true)} />
        </div>
        <DbMarketplaceLegalNotice text={MARKETPLACE_LEGAL_NOTICE} />
        <DbMarketplaceSideSegment options={sideOptionsWithBadges} active={side} onChange={setSide} />
        <DbMarketplaceTabBar options={tabOptionsWithBadges} active={uiTab} onChange={setUiTab} />
        <DbMarketplaceHintBanner text={hintText} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2 sm:p-4 shadow-sm">
        {showListFilters ? (
          <DbMarketplaceMySalesFilters
            filters={mySalesFilters}
            partners={audiencePartners}
            externalCompanies={audienceExternals}
            onChange={onMySalesFiltersChange}
          />
        ) : null}

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
          <p className="mt-6 p-8 text-center text-fluid-sm text-gray-500">{emptyTitle}</p>
        ) : null}

        <div className="mt-4 hidden lg:block overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className={`w-full table-fixed border-collapse text-fluid-xs ${showMySalesMeta || showConfirmedMeta ? 'min-w-[960px]' : 'min-w-[800px]'}`}>
            <colgroup>
              {selectable ? <MarketplaceTableCheckboxCol /> : null}
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[24%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              {showMySalesMeta ? (
                <>
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                </>
              ) : null}
              {showConfirmedMeta ? (
                <>
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                </>
              ) : null}
              {showPendingMeta ? <col className="w-[10%]" /> : null}
              {showSellerColumn ? <col className="w-[10%]" /> : null}
              <col className="w-[8%]" />
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
                <th className="px-2 py-2 text-center">공유수수료</th>
                <th className="px-2 py-2 text-center">잔금</th>
                {showMySalesMeta ? (
                  <>
                    <th className="px-2 py-2 text-center">공유일</th>
                    <th className="px-2 py-2 text-center">인계날짜</th>
                    <th className="px-2 py-2 text-center">인계업체</th>
                  </>
                ) : null}
                {showConfirmedMeta ? (
                  <>
                    <th className="px-2 py-2 text-center">상대 업체</th>
                    <th className="px-2 py-2 text-center">인계일</th>
                  </>
                ) : null}
                {showPendingMeta ? <th className="px-2 py-2 text-center">인계 요청 업체</th> : null}
                {showSellerColumn ? <th className="px-2 py-2 text-center">공유 업체</th> : null}
                <th className="px-2 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {displayGroups.map((group) => (
                <Fragment key={group.label ?? '__flat__'}>
                  {group.label ? (
                    <tr className="border-b border-slate-200 bg-slate-100/90">
                      <td
                        colSpan={tableColSpan}
                        className="px-2 py-1.5 text-left text-fluid-2xs font-semibold text-slate-800"
                      >
                        {group.label}
                        <span className="ml-2 font-normal tabular-nums text-slate-600">{group.items.length}건</span>
                      </td>
                    </tr>
                  ) : null}
                  {group.items.map((row) => {
                    const canSelect = canSelectRow(row);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedRow(row)}
                      >
                        {selectable ? (
                          <td
                            {...marketplaceTableCheckboxCellProps()}
                            onClick={(e) => e.stopPropagation()}
                          >
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
                        {showMySalesMeta ? (
                          <>
                            <td className="px-2 py-2 text-center tabular-nums">
                              {formatMarketplaceListDate(row.publishedAt)}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums">
                              {formatMarketplaceListDate(row.sellerConfirmedAt)}
                            </td>
                            <td className="px-2 py-2 text-center truncate" title={row.buyerName ?? undefined}>
                              {row.buyerName ?? '-'}
                            </td>
                          </>
                        ) : null}
                        {showConfirmedMeta ? (
                          <>
                            <td
                              className="px-2 py-2 text-center truncate"
                              title={
                                row.role === 'SELLER'
                                  ? row.buyerName ?? undefined
                                  : row.sellerTenantName
                              }
                            >
                              {row.role === 'SELLER' ? (row.buyerName ?? '-') : row.sellerTenantName}
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums">
                              {formatMarketplaceListDate(row.sellerConfirmedAt)}
                            </td>
                          </>
                        ) : null}
                        {showPendingMeta ? (
                          <td
                            className="px-2 py-2 text-center truncate font-medium text-amber-900"
                            title={
                              row.role === 'SELLER'
                                ? row.buyerName ?? undefined
                                : row.sellerTenantName
                            }
                          >
                            {row.role === 'SELLER' ? (row.buyerName ?? '-') : row.sellerTenantName}
                          </td>
                        ) : null}
                        {showSellerColumn ? (
                          <td className="px-2 py-2 text-center truncate" title={row.sellerTenantName}>
                            {row.sellerTenantName}
                          </td>
                        ) : null}
                        <td className="px-2 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[12px] ${MARKETPLACE_STATUS_CLASS[row.status] ?? ''}`}
                          >
                            {MARKETPLACE_STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
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

        <div className="mt-4 space-y-3 lg:hidden">
          {displayGroups.map((group) => (
            <Fragment key={group.label ?? '__flat__'}>
              {group.label ? (
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-fluid-xs font-semibold text-slate-800">
                  {group.label}
                  <span className="ml-2 font-normal tabular-nums text-slate-600">{group.items.length}건</span>
                </div>
              ) : null}
              {group.items.map((row) => (
                <DbMarketplaceRowCard
                  key={row.id}
                  row={row}
                  onOpen={() => setSelectedRow(row)}
                  selectable={selectable}
                  selected={selectedIds.has(row.id)}
                  onToggleSelect={() => toggleRow(row.id)}
                  bulkMode={bulkMode}
                  showSeller={showSellerColumn}
                  showMySalesMeta={showMySalesMeta}
                  showConfirmedMeta={showConfirmedMeta}
                  showPendingMeta={showPendingMeta}
                  compactAmount={compactAmountMobile}
                />
              ))}
            </Fragment>
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
          <>
            <DbMarketplacePublishBulkButton disabled={bulkBusy} onClick={() => setAudienceModalOpen(true)} />
            <DbMarketplaceRevertBulkButton disabled={bulkBusy} onClick={() => void runBulkRemoveFromCart()} />
          </>
        ) : bulkMode === 'buy' ? (
          <>
            <DbMarketplaceBuyBulkButton disabled={bulkBusy} onClick={() => void runBulkBuy()} />
            <DbMarketplaceBuyerDeclineBulkButton
              disabled={bulkBusy}
              onClick={() => void runBulkBuyerDecline()}
            />
          </>
        ) : bulkMode === 'revert_cart' ? (
          <DbMarketplaceRevertToCartButton disabled={bulkBusy} onClick={() => void runBulkRevertToCart()} />
        ) : (
          <>
            <DbMarketplaceConfirmBulkButton disabled={bulkBusy} onClick={() => void runBulkSellerConfirm()} />
            <DbMarketplaceDeclineBulkButton disabled={bulkBusy} onClick={() => void runBulkSellerDecline()} />
          </>
        )}
      </DbMarketplaceBulkActionBar>
      ) : null}

      <DbMarketplaceAudiencePickerModal
        open={audienceModalOpen}
        onClose={() => setAudienceModalOpen(false)}
        busy={bulkBusy}
        title="일괄 노출 대상"
        description={`선택 ${selectedCount}건에 동일한 노출 업체를 적용한 뒤 공유합니다.`}
        confirmLabel="공유하기"
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
          onChanged={refreshAfterChange}
        />
      ) : null}

      <DbMarketplaceHelpModal open={marketplaceHelpOpen} onClose={() => setMarketplaceHelpOpen(false)} />
    </div>
  );
}
