import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import {
  listTeamDbMarketplace,
  getTeamDbMarketplaceListing,
  type DbMarketplaceMaskedItem,
  type TeamDbMarketplaceListTab,
} from '../../api/dbMarketplace';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { DbMarketplaceListingDetailModal } from '../../components/admin/DbMarketplaceListingDetailModal';
import {
  formatMarketplaceCleaningSummary,
  formatMarketplaceSchedule,
} from '../../utils/dbMarketplaceDisplay';
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

function MarketplaceRowCard({
  row,
  onOpen,
}: {
  row: DbMarketplaceMaskedItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-fluid-sm font-semibold text-slate-900">
            {row.customerNameMasked}
            <span className="ml-2 font-normal text-gray-500">{row.addressRegion}</span>
          </p>
          <p className="mt-1 text-fluid-xs text-gray-600">{cleaningSummary(row)}</p>
          <p className="mt-1 text-fluid-xs text-gray-500">{formatMarketplaceSchedule(row)}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[row.status] ?? ''}`}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
          <p className="mt-2 text-fluid-sm font-semibold tabular-nums text-slate-900">
            {row.displayAmount != null ? `${row.displayAmount.toLocaleString('ko-KR')}원` : '-'}
          </p>
        </div>
      </div>
    </button>
  );
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

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div>
        <h1 className="text-fluid-lg font-semibold text-slate-900">정보공유</h1>
        <p className="mt-1 text-fluid-xs text-gray-600">
          구매 전에는 시·구 주소와 표시금액(잔금−수수료)만 확인할 수 있습니다. 발주 업체 인계 확정 후 전체 DB가 공개됩니다.
        </p>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
        {TAB_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTab(opt.id)}
            className={`rounded-md px-3 py-1.5 text-fluid-xs font-medium transition-colors ${
              tab === opt.id ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

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
          <p className="mt-6 p-8 text-center text-fluid-sm text-gray-500">
            {tabLabel} 항목이 없습니다.
          </p>
        ) : null}

        <div className="mt-4 hidden lg:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full table-fixed border-collapse text-fluid-xs min-w-[640px]">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[28%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="px-2 py-2 text-center">고객</th>
                <th className="px-2 py-2 text-center">지역</th>
                <th className="px-2 py-2 text-center">청소 요약</th>
                <th className="px-2 py-2 text-center">일정</th>
                <th className="px-2 py-2 text-center">표시금액</th>
                <th className="px-2 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedRow(row)}
                >
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
                    {row.displayAmount != null ? `${row.displayAmount.toLocaleString('ko-KR')}원` : '-'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLASS[row.status] ?? ''}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-center text-[11px] text-gray-500 lg:hidden">표는 좌우로 스크롤할 수 있습니다.</p>

        <div className="mt-4 space-y-3 lg:hidden">
          {items.map((row) => (
            <MarketplaceRowCard key={row.id} row={row} onOpen={() => setSelectedRow(row)} />
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
