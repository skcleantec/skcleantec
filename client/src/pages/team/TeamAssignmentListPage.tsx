import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { beginListRefresh, shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import {
  completeTeamHappyCall,
  getTeamHappyCallStats,
  getTeamInquiries,
  getTeamMe,
  patchTeamInquiryPreferredDate,
} from '../../api/team';
import { isAuthSessionExpiredError } from '../../api/auth';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useIsLgUp } from '../../hooks/useMediaQuery';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { shortTimeSlotLabel } from '../../constants/orderFormSchedule';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import {
  STATUS_LABELS,
  type InquiryItem,
  formatRoomInfo,
  formatCrewInfo,
  marketerInfo,
  TeamHappyCallBadge,
  TeamInquiryDetailModal,
  formatTeamInquiryAreaSummary,
  coLeadersSummaryForViewer,
  TeamCoLeadersListHint,
  TeamNoCrewMembersListBadge,
  TeamInquiryPaymentTotalListBadge,
  TeamInquirySpecialNotesListBadge,
  teamInquiryCustomerPaymentTotal,
} from './teamInquiryShared';
import { InspectionProgressBadge } from '../../components/inquiry-inspection/InspectionProgressBadge';
import { useHasTenantFeature } from '../../hooks/useTenantCapabilities';
import { addressListShortSiGu, inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../../utils/listPagination';
import { TeamBiLine, TeamBiInline, teamBiPlain } from '../../i18n/team/teamI18n';
import { useTeamOpenInquiryDeepLink } from '../../hooks/useTeamOpenInquiryDeepLink';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

type DatePreset = 'today' | 'all' | 'month' | 'day';
type DateBasis = 'assignedAt' | 'createdAt' | 'preferredDate';

function parseDatePreset(raw: string | null): DatePreset {
  if (raw === 'today' || raw === 'all' || raw === 'month' || raw === 'day') return raw;
  return 'month';
}

function parseDateBasis(raw: string | null): DateBasis {
  if (raw === 'createdAt' || raw === 'preferredDate') return raw;
  return 'assignedAt';
}

function myAssignment(item: InquiryItem, myId: string) {
  return item.assignments.find((a) => a.teamLeader.id === myId);
}

function formatAssignedAt(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function TeamAssignmentListPage() {
  const isLgUp = useIsLgUp();
  const hasInspectionModule = useHasTenantFeature('mod_inspection');
  const token = getTeamToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewKey = teamPreviewDepsKey(location.search);
  const { capturePreviewKey, isPreviewFetchStale } = useTeamPreviewStaleGuard(previewKey);

  const datePreset = parseDatePreset(searchParams.get('datePreset'));
  const monthKey = useMemo(() => {
    const m = searchParams.get('month');
    if (m && /^\d{4}-\d{2}$/.test(m)) return m;
    return kstMonthKeyNow();
  }, [searchParams]);
  const dayKey = useMemo(() => {
    const d = searchParams.get('day');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return kstTodayYmd();
  }, [searchParams]);
  const dateBasis = parseDateBasis(searchParams.get('dateBasis'));
  const statusFilter = searchParams.get('status') ?? '';
  const appliedSearch = searchParams.get('q') ?? '';
  const listPage = parseListPage(searchParams.get('page'));
  const listPageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const [searchInput, setSearchInput] = useState(appliedSearch);
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { preserveScroll, scrollToTop } = useStaffAppScrollPreserve();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InquiryItem | null>(null);
  const [happyStats, setHappyStats] = useState({ overdueCount: 0, pendingBeforeDeadlineCount: 0 });

  useTeamOpenInquiryDeepLink(token, setDetailItem);

  const patchListParams = useCallback(
    (patch: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          patch(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const listQueryKey = useMemo(
    () =>
      [
        datePreset,
        monthKey,
        dayKey,
        dateBasis,
        statusFilter,
        appliedSearch,
        listPage,
        listPageSize,
        previewKey,
      ].join('\0'),
    [datePreset, monthKey, dayKey, dateBasis, statusFilter, appliedSearch, listPage, listPageSize, previewKey],
  );

  const loadList = useCallback(
    async (opts?: { silent?: boolean; scrollToTop?: boolean }) => {
      if (!token) return;
      const silent = opts?.silent === true;
      if (opts?.scrollToTop) scrollToTop();
      if (!silent) {
        beginListRefresh({
          showLoading: true,
          itemCount: items.length,
          setLoading,
          preserveScroll,
        });
        setLoadError(null);
      } else if (items.length > 0) {
        preserveScroll();
      }
      const startedKey = capturePreviewKey();
      try {
        const offset = (listPage - 1) * listPageSize;
        const [me, inv, hc] = await Promise.all([
          getTeamMe(token) as Promise<{ id: string }>,
          getTeamInquiries(token, {
            datePreset,
            month: datePreset === 'month' ? monthKey : undefined,
            day: datePreset === 'day' ? dayKey : undefined,
            dateBasis,
            status: statusFilter || undefined,
            q: appliedSearch.trim() || undefined,
            limit: listPageSize,
            offset,
          }) as Promise<{ items: InquiryItem[]; total: number }>,
          getTeamHappyCallStats(token).catch(() => ({ overdueCount: 0, pendingBeforeDeadlineCount: 0 })),
        ]);
        if (isPreviewFetchStale(startedKey)) return;
        setMyId(me.id);
        setItems(inv.items);
        setListTotal(typeof inv.total === 'number' ? inv.total : inv.items.length);
        setHappyStats(hc);
        if (!opts?.silent) setLoadError(null);
      } catch (e) {
        if (isPreviewFetchStale(startedKey)) return;
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setItems([]);
        setListTotal(0);
        setMyId(null);
        setLoadError(e instanceof Error ? e.message : teamBiPlain('team.assign.loadFail'));
      } finally {
        if (!opts?.silent && !isPreviewFetchStale(startedKey)) setLoading(false);
      }
    },
    [
      token,
      navigate,
      listQueryKey,
      datePreset,
      monthKey,
      dayKey,
      dateBasis,
      statusFilter,
      appliedSearch,
      listPage,
      listPageSize,
      capturePreviewKey,
      isPreviewFetchStale,
      items.length,
      preserveScroll,
      scrollToTop,
    ],
  );

  const prevListQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevListQueryKeyRef.current;
    prevListQueryKeyRef.current = listQueryKey;
    void loadList({ scrollToTop: prev !== null && prev !== listQueryKey });
  }, [loadList, listQueryKey]);

  useEffect(() => {
    setSearchInput(appliedSearch);
  }, [appliedSearch]);

  const lastSilentRefreshRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 4000) return;
    lastSilentRefreshRef.current = now;
    void loadList({ silent: true });
  }, [loadList]);

  const { connected: assignmentWsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !assignmentWsConnected ? 20000 : 0);

  const applyDatePreset = (preset: DatePreset) => {
    patchListParams((next) => {
      next.set('datePreset', preset);
      if (preset === 'month') {
        next.set('month', monthKey);
        next.delete('day');
      } else if (preset === 'day') {
        next.set('day', dayKey);
        next.delete('month');
      } else {
        next.delete('month');
        next.delete('day');
      }
      next.delete('page');
    });
  };

  const handleListPageChange = (page: number) => {
    patchListParams((next) => {
      if (page <= 1) next.delete('page');
      else next.set('page', String(page));
    });
  };

  const handleListPageSizeChange = (size: InquiryListPageSize) => {
    patchListParams((next) => {
      if (size === INQUIRY_LIST_DEFAULT_PAGE_SIZE) next.delete('pageSize');
      else next.set('pageSize', String(size));
      next.delete('page');
    });
  };

  const paginatedRows = items;

  const filterSelectCls =
    'rounded border border-gray-300 bg-white px-1.5 py-0.5 text-fluid-2xs shrink-0 min-h-0';
  const filterBtnCls = (active: boolean, bordered?: boolean) =>
    `px-2 py-0.5 text-fluid-2xs font-medium touch-manipulation min-h-0 ${bordered ? 'border-l border-gray-300' : ''} ${
      active ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
    }`;

  if (shouldShowListBlockingLoading(loading, items.length)) {
    return (
      <div className="py-12 text-center text-gray-500 text-fluid-sm">
        <TeamBiLine id="team.common.loading" koClassName="text-fluid-sm text-gray-500" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          <TeamBiLine id="team.assign.title" koClassName="text-xl font-semibold text-gray-800" />
        </h1>
      </div>

      {(happyStats.overdueCount > 0 || happyStats.pendingBeforeDeadlineCount > 0) && (
        <div
          className={`rounded-xl border px-4 py-3 text-fluid-sm space-y-2 ${
            happyStats.overdueCount > 0
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <TeamBiLine id="team.assign.happyIncompleteLead" koClassName="text-fluid-sm font-medium" />
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
            {happyStats.overdueCount > 0 ? (
              <TeamBiLine
                id="team.assign.happyOverdueCases"
                vars={{ count: String(happyStats.overdueCount) }}
                koClassName="text-fluid-sm tabular-nums"
              />
            ) : null}
            {happyStats.pendingBeforeDeadlineCount > 0 ? (
              <TeamBiLine
                id="team.assign.happyPendingCases"
                vars={{ count: String(happyStats.pendingBeforeDeadlineCount) }}
                koClassName="text-fluid-sm tabular-nums"
              />
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 sm:p-3 min-w-0">
        <div className="flex w-full flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          <select
            value={dateBasis}
            onChange={(e) => {
              const v = e.target.value as DateBasis;
              patchListParams((next) => {
                next.set('dateBasis', v);
                next.delete('page');
              });
            }}
            className={filterSelectCls}
            aria-label={teamBiPlain('team.assign.dateBasis')}
          >
            <option value="assignedAt">{teamBiPlain('team.assign.basisAssigned')}</option>
            <option value="createdAt">{teamBiPlain('team.assign.basisCreated')}</option>
            <option value="preferredDate">{teamBiPlain('team.assign.basisPreferred')}</option>
          </select>
          <div className="inline-flex rounded border border-gray-300 overflow-hidden text-fluid-2xs shrink-0">
            {(
              [
                ['today', '당일'],
                ['all', '전체'],
                ['month', '월별'],
                ['day', '날짜'],
              ] as const
            ).map(([id, label], i) => (
              <button
                key={id}
                type="button"
                onClick={() => applyDatePreset(id)}
                className={filterBtnCls(datePreset === id, i > 0)}
              >
                {label}
              </button>
            ))}
          </div>
          {datePreset === 'month' ? (
            <YearMonthSelect
              compact
              value={monthKey}
              onChange={(v) => {
                patchListParams((next) => {
                  next.set('datePreset', 'month');
                  next.set('month', v);
                  next.delete('day');
                  next.delete('page');
                });
              }}
              idPrefix="team-assign-month"
            />
          ) : null}
          {datePreset === 'day' ? (
            <YmdSelect
              compact
              value={dayKey}
              onChange={(v) => {
                patchListParams((next) => {
                  next.set('datePreset', 'day');
                  next.set('day', v);
                  next.delete('month');
                  next.delete('page');
                });
              }}
              idPrefix="team-assign-day"
            />
          ) : null}
          <div className="lg:ml-auto flex min-w-0 flex-wrap items-center justify-end">
            <ListPaginationBar
              compact
              mode="summary"
              page={listPage}
              pageSize={listPageSize}
              total={listTotal}
              onPageChange={handleListPageChange}
              onPageSizeChange={handleListPageSizeChange}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-0.5 text-fluid-2xs text-gray-600 min-w-0 sm:w-36">
            <TeamBiInline id="team.assign.status" />
            <select
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value;
                patchListParams((next) => {
                  if (v) next.set('status', v);
                  else next.delete('status');
                  next.delete('page');
                });
              }}
              className={filterSelectCls}
            >
              <option value="">{teamBiPlain('team.common.all')}</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-1 min-w-0 flex-col gap-0.5 sm:max-w-md">
            <TeamBiLine id="team.assign.searchHint" koClassName="text-fluid-2xs text-gray-600" />
            <div className="flex gap-1.5">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    patchListParams((next) => {
                      const q = searchInput.trim();
                      if (q) next.set('q', q);
                      else next.delete('q');
                      next.delete('page');
                    });
                  }
                }}
                className={`min-w-0 flex-1 ${filterSelectCls}`}
                placeholder={teamBiPlain('team.assign.searchPlaceholder')}
              />
              <button
                type="button"
                onClick={() => {
                  patchListParams((next) => {
                    const q = searchInput.trim();
                    if (q) next.set('q', q);
                    else next.delete('q');
                    next.delete('page');
                  });
                }}
                className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-fluid-2xs font-medium text-white touch-manipulation min-h-0"
              >
                <TeamBiInline id="team.assign.searchBtn" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-900">{loadError}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        {listTotal === 0 ? (
          <div className="p-8 text-center text-fluid-sm text-gray-500">
            <TeamBiLine id="team.assign.empty" koClassName="text-fluid-sm text-gray-500" />
          </div>
        ) : (
          <>
            {isLgUp ? (
            <p className="hidden px-4 pt-3 text-fluid-xs text-gray-500 lg:block sm:px-0">
              <TeamBiLine id="team.assign.desktopHint" koClassName="text-fluid-xs text-gray-500" />
            </p>
            ) : null}

            {!isLgUp ? (
            <div className="flex flex-col gap-3 p-3">
              {paginatedRows.map((item) => {
                const mine = myAssignment(item, myId!);
                const addrFull = `${item.address}${item.addressDetail ? ` ${item.addressDetail}` : ''}`.trim();
                const addr = addressListShortSiGu(item.address);
                const mk = marketerInfo(item);
                const primaryLabel = inquiryPrimaryCustomerLabel(item);
                const memoTrim = item.scheduleMemo?.trim() ?? '';
                const memoSubtitle = memoTrim && memoTrim !== primaryLabel;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${primaryLabel} · ${teamBiPlain('team.assign.detailAria')}`}
                    onClick={() => setDetailItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailItem(item);
                      }
                    }}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 shadow-sm outline-none ring-gray-300 transition hover:border-gray-300 hover:shadow active:bg-gray-50 focus-visible:ring-2 touch-manipulation"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-fluid-sm font-semibold text-gray-900">{primaryLabel}</span>
                          {item.claimMemo ? (
                            <span
                              className="shrink-0 text-orange-600"
                              title={item.claimMemo}
                              aria-label={teamBiPlain('team.assign.csDotAria')}
                            >
                              ●
                            </span>
                          ) : null}
                          <TeamInquirySpecialNotesListBadge item={item} />
                          <TeamInquiryPaymentTotalListBadge item={item} />
                          {item.inquiryNumber ? (
                            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-fluid-2xs tabular-nums text-gray-700">
                              {item.inquiryNumber}
                            </span>
                          ) : null}
                        </div>
                        {memoSubtitle ? (
                          <p className="mt-1 line-clamp-1 text-fluid-xs text-gray-700" title={memoTrim}>
                            {memoTrim}
                          </p>
                        ) : null}
                        {item.memo?.trim() ? (
                          <p
                            className="mt-0.5 line-clamp-2 text-fluid-2xs leading-snug text-indigo-900/90"
                            title={`${teamBiPlain('team.common.adminMemoPrefix')} ${item.memo.trim()}`}
                          >
                            {teamBiPlain('team.common.adminMemoPrefix')} {item.memo.trim()}
                          </p>
                        ) : null}
                        <p className="mt-1 text-fluid-xs tabular-nums text-gray-500">
                          {teamBiPlain('team.assign.assignedPrefix')} {formatAssignedAt(mine?.assignedAt)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-fluid-xs text-gray-600">
                          <span>
                            {teamBiPlain('team.assign.marketerPrefix')} {mk.name}
                          </span>
                          {mk.phone ? (
                            <a
                              href={`tel:${mk.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-fluid-2xs font-medium text-blue-700"
                            >
                              <TeamBiInline id="team.assign.marketerPhone" />
                            </a>
                          ) : null}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-fluid-xs leading-snug text-gray-600" title={addrFull}>
                          {addr}
                        </p>
                      </div>
                      <a
                        href={`tel:${item.customerPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 self-start rounded-lg bg-blue-600 px-3 py-2 text-center text-fluid-xs font-medium text-white hover:bg-blue-700"
                      >
                        <TeamBiInline id="team.common.phone" />
                      </a>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-fluid-xs text-gray-700">
                      <span className="tabular-nums">
                        {teamBiPlain('team.assign.bookingPrefix')}{' '}
                        {item.preferredDate ? formatDateCompactWithWeekday(item.preferredDate) : teamBiPlain('team.common.emDash')}
                      </span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-fluid-2xs font-medium text-gray-800">
                        {item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : teamBiPlain('team.inquiry.timeUndecided')}
                      </span>
                      <span className="inline-flex rounded-md bg-gray-200 px-2 py-0.5 text-fluid-2xs font-medium text-gray-800">
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      <TeamHappyCallBadge item={item} variant="list" />
                      <TeamNoCrewMembersListBadge item={item} viewerId={myId} />
                      {hasInspectionModule ? (
                        <InspectionProgressBadge summary={item.inspectionSummary} variant="list" />
                      ) : null}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-fluid-2xs text-gray-600" title={formatCrewInfo(item)}>
                      {formatCrewInfo(item)}
                    </p>
                    <TeamCoLeadersListHint item={item} viewerId={myId} />
                  </div>
                );
              })}
            </div>
            ) : null}

            {isLgUp ? (
            <div>
            <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full table-fixed text-fluid-sm border-collapse min-w-[1020px]">
                <colgroup>
                  <col className="w-[8.5rem]" />
                  <col className="w-[5.5rem]" />
                  <col className="w-[6.5rem]" />
                  <col className="w-[7rem]" />
                  <col className="w-[6.5rem]" />
                  <col className="w-[9rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[5.5rem]" />
                  <col className="w-[5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[5rem]" />
                  <col className="w-[4.5rem]" />
                  <col className="w-[5.5rem]" />
                  <col className="w-[6rem]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                      <TeamBiLine id="team.assign.thAssignedAt" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thCreatedNum" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thAssigner" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thCustomer" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thPhone" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 min-w-[88px] align-middle">
                      <TeamBiLine id="team.assign.thAddress" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thArea" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thRooms" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thPrefDate" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thTimeSlot" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thStatus" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thDeposit" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thHappy" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                    {hasInspectionModule ? (
                      <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                        <span className="text-fluid-xs font-medium text-gray-700">현장검수</span>
                      </th>
                    ) : null}
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap align-middle">
                      <TeamBiLine id="team.assign.thCoLeaders" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((item) => {
                    const mine = myAssignment(item, myId!);
                    const mk = marketerInfo(item);
                    const primaryLabel = inquiryPrimaryCustomerLabel(item);
                    const memoTrim = item.scheduleMemo?.trim() ?? '';
                    const memoSubtitle = memoTrim && memoTrim !== primaryLabel;
                    const paymentTotal = teamInquiryCustomerPaymentTotal(item);
                    const pBorder = 'border-b border-gray-100';
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer group hover:bg-gray-50 active:bg-gray-100"
                        onClick={() => setDetailItem(item)}
                      >
                        <td
                          className={`align-middle py-2 px-2 text-center text-gray-700 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-gray-50 ${pBorder}`}
                        >
                          <span className="text-fluid-xs tabular-nums">{formatAssignedAt(mine?.assignedAt)}</span>
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center ${pBorder}`}>
                          <span className="text-fluid-xs tabular-nums block">
                            {formatDateCompactWithWeekday(item.createdAt)}
                          </span>
                          {item.inquiryNumber ? (
                            <span className="text-fluid-2xs text-gray-500 tabular-nums block mt-0.5">
                              {item.inquiryNumber}
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={`align-middle py-2 px-2 text-gray-600 text-center truncate max-w-[7rem] ${pBorder}`}
                          title={mine?.assignedBy?.name ?? ''}
                        >
                          {mine?.assignedBy?.name ?? teamBiPlain('team.common.emDash')}
                          <span
                            className="mt-0.5 block truncate text-fluid-2xs text-gray-500"
                            title={`${teamBiPlain('team.assign.marketerPrefix')} ${mk.name}`}
                          >
                            {teamBiPlain('team.assign.marketerPrefix')} {mk.name}
                          </span>
                          {mk.phone ? (
                            <a
                              href={`tel:${mk.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-fluid-2xs font-medium text-blue-700"
                            >
                              <TeamBiInline id="team.common.phone" />
                            </a>
                          ) : null}
                        </td>
                        <td
                          className={`align-middle py-2 px-2 font-medium text-gray-900 text-center whitespace-nowrap ${pBorder}`}
                        >
                          <div className="flex min-w-0 flex-col items-center leading-tight">
                            <div className="min-w-0 max-w-full truncate">
                              {primaryLabel}
                              {item.claimMemo ? (
                                <span className="ml-1 text-orange-600" title={item.claimMemo}>
                                  ●
                                </span>
                              ) : null}
                              <TeamInquirySpecialNotesListBadge item={item} className="ml-1 align-middle" />
                            </div>
                            {memoSubtitle ? (
                              <div
                                className="mt-0.5 max-w-full truncate text-fluid-2xs font-normal text-gray-600"
                                title={memoTrim}
                              >
                                {memoTrim}
                              </div>
                            ) : null}
                            {item.memo?.trim() ? (
                              <div
                                className="mt-0.5 max-w-full truncate text-fluid-2xs font-normal text-indigo-900/85"
                                title={`${teamBiPlain('team.common.adminMemoPrefix')} ${item.memo.trim()}`}
                              >
                                {teamBiPlain('team.common.adminMemoPrefix')} {item.memo.trim()}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className={`align-middle py-2 px-2 text-gray-600 text-center break-all max-w-[7rem] ${pBorder}`}
                        >
                          {item.customerPhone}
                        </td>
                        <td
                          className={`align-middle py-2 px-2 text-gray-600 text-center max-w-[140px] truncate ${pBorder}`}
                          title={`${item.address}${item.addressDetail ? ` ${item.addressDetail}` : ''}`.trim()}
                        >
                          {addressListShortSiGu(item.address)}
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center whitespace-nowrap ${pBorder}`}>
                          {formatTeamInquiryAreaSummary(item)}
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center whitespace-nowrap ${pBorder}`}>
                          {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}
                          <span className="mt-0.5 block truncate text-fluid-2xs text-gray-500" title={formatCrewInfo(item)}>
                            {formatCrewInfo(item)}
                          </span>
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center whitespace-nowrap ${pBorder}`}>
                          <span className="text-fluid-xs tabular-nums">
                            {formatDateCompactWithWeekday(item.preferredDate)}
                          </span>
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center whitespace-nowrap ${pBorder}`}>
                          {item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : teamBiPlain('team.inquiry.timeUndecided')}
                        </td>
                        <td className={`align-middle py-2 px-2 text-center whitespace-nowrap ${pBorder}`}>
                          <span className="inline-block rounded bg-gray-200 px-2 py-0.5 text-fluid-2xs text-gray-800">
                            {STATUS_LABELS[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className={`align-middle py-2 px-2 text-center whitespace-nowrap tabular-nums ${pBorder}`}>
                          {paymentTotal != null ? (
                            <span
                              className="text-fluid-2xs font-medium text-amber-900"
                              title={`고객 결제 총액 ${Number(paymentTotal).toLocaleString('ko-KR')}원`}
                            >
                              {Number(paymentTotal).toLocaleString('ko-KR')}
                            </span>
                          ) : (
                            <span className="text-fluid-xs text-gray-400">{teamBiPlain('team.common.emDash')}</span>
                          )}
                        </td>
                        <td className={`align-middle py-2 px-2 text-center ${pBorder}`}>
                          <TeamHappyCallBadge item={item} variant="list" />
                      <TeamNoCrewMembersListBadge item={item} viewerId={myId} />
                        </td>
                        {hasInspectionModule ? (
                          <td className={`align-middle py-2 px-2 text-center ${pBorder}`}>
                            <InspectionProgressBadge summary={item.inspectionSummary} variant="list" />
                          </td>
                        ) : null}
                        <td
                          className={`align-middle py-2 px-2 text-gray-600 text-center max-w-[120px] truncate ${pBorder}`}
                          title={coLeadersSummaryForViewer(item, myId!)}
                        >
                          {coLeadersSummaryForViewer(item, myId!)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SyncHorizontalScroll>
            </div>
            ) : null}
            <ListPaginationBar
              mode="nav"
              page={listPage}
              pageSize={listPageSize}
              total={listTotal}
              onPageChange={handleListPageChange}
              onPageSizeChange={handleListPageSizeChange}
            />
          </>
        )}
      </div>

      {detailItem && myId && (
        <TeamInquiryDetailModal
          item={detailItem}
          viewerTeamLeaderId={myId}
          onClose={() => setDetailItem(null)}
          enableHappyCall
          onInquiryPatched={(next) => setDetailItem(next)}
          onPreferredDateChange={async (preferredDate) => {
            if (!token) return;
            await patchTeamInquiryPreferredDate(token, detailItem.id, preferredDate);
            await loadList({ silent: true });
          }}
          onHappyCallComplete={async () => {
            if (!token) return;
            await completeTeamHappyCall(token, detailItem.id);
            await loadList({ silent: true });
          }}
        />
      )}
    </div>
  );
}
