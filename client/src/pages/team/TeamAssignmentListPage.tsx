import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  completeTeamHappyCall,
  getTeamHappyCallStats,
  getTeamInquiries,
  getTeamMe,
  patchTeamInquiryPreferredDate,
} from '../../api/team';
import { isAuthSessionExpiredError } from '../../api/auth';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { shortTimeSlotLabel } from '../../constants/orderFormSchedule';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import {
  DATE_RANGE_PRESET_LABELS,
  computeDateRangeFromPreset,
  type DateRangePresetId,
} from '../../utils/dateRangePresets';
import {
  STATUS_LABELS,
  type InquiryItem,
  formatRoomInfo,
  formatCrewInfo,
  marketerInfo,
  TeamHappyCallBadge,
  TeamInquiryDetailModal,
  formatTeamInquiryAreaSummary,
} from './teamInquiryShared';
import { inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
import { teamPreviewDepsKey } from '../../utils/teamPreviewQuery';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  clampListPage,
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  type InquiryListPageSize,
} from '../../utils/listPagination';
import { TeamBiLine, TeamBiInline, teamBiPlain } from '../../i18n/team/teamI18n';

function toKstYmd(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function preferredYmd(item: InquiryItem): string | null {
  if (!item.preferredDate) return null;
  const s = item.preferredDate;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return toKstYmd(s);
}

function myAssignment(item: InquiryItem, myId: string) {
  return item.assignments.find((a) => a.teamLeader.id === myId);
}

function leaderLabel(u: InquiryItem['assignments'][0]['teamLeader']): string {
  if (u.role === 'EXTERNAL_PARTNER') {
    const tag = teamBiPlain('team.modal.externalPartnerTag');
    return u.externalCompany?.name ? `${tag} ${u.externalCompany.name}` : `${tag} ${u.name}`;
  }
  return u.name;
}

function coLeadersSummary(item: InquiryItem, myId: string): string {
  const others = item.assignments.filter((a) => a.teamLeader.id !== myId).map((a) => leaderLabel(a.teamLeader));
  return others.length ? others.join(' · ') : '—';
}

function formatAssignedAt(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type DateBasis = 'assignedAt' | 'createdAt' | 'preferredDate';

function rowDateYmdForBasis(item: InquiryItem, myId: string, basis: DateBasis): string | null {
  if (basis === 'createdAt') return toKstYmd(item.createdAt);
  if (basis === 'preferredDate') return preferredYmd(item);
  const mine = myAssignment(item, myId);
  if (mine?.assignedAt) return toKstYmd(mine.assignedAt);
  /** 배정일이 응답에 없을 때 접수일로 간주 — 이번 달 필터에서 신규 배정이 통째로 빠지는 것 방지 */
  return toKstYmd(item.createdAt);
}

function inYmdRange(ymd: string | null, from: string, to: string): boolean {
  if (!ymd) return false;
  return ymd >= from && ymd <= to;
}

export function TeamAssignmentListPage() {
  const token = getTeamToken();
  const navigate = useNavigate();
  const location = useLocation();
  const previewKey = teamPreviewDepsKey(location.search);
  const initialRange = computeDateRangeFromPreset('thisMonth')!;
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [preset, setPreset] = useState<DateRangePresetId>('thisMonth');
  const [dateBasis, setDateBasis] = useState<DateBasis>('assignedAt');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InquiryItem | null>(null);
  const [happyStats, setHappyStats] = useState({ overdueCount: 0, pendingBeforeDeadlineCount: 0 });
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState<InquiryListPageSize>(INQUIRY_LIST_DEFAULT_PAGE_SIZE);

  const loadList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const [me, inv, hc] = await Promise.all([
          getTeamMe(token) as Promise<{ id: string }>,
          getTeamInquiries(token) as Promise<{ items: InquiryItem[] }>,
          getTeamHappyCallStats(token).catch(() => ({ overdueCount: 0, pendingBeforeDeadlineCount: 0 })),
        ]);
        setMyId(me.id);
        setItems(inv.items);
        setHappyStats(hc);
        if (!opts?.silent) setLoadError(null);
      } catch (e) {
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
        setItems([]);
        setMyId(null);
        setLoadError(e instanceof Error ? e.message : teamBiPlain('team.assign.loadFail'));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [token, navigate, previewKey]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const silentRefresh = useCallback(() => {
    void loadList({ silent: true });
  }, [loadList]);

  const { connected: assignmentWsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !assignmentWsConnected ? 20000 : 0);

  const applyPreset = (id: DateRangePresetId) => {
    setPreset(id);
    if (id === 'custom') return;
    const r = computeDateRangeFromPreset(id);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const filteredSorted = useMemo(() => {
    if (!myId) return [];
    const lo = from <= to ? from : to;
    const hi = from <= to ? to : from;
    const q = appliedSearch.trim().toLowerCase();
    const rows = items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      const rowYmd = rowDateYmdForBasis(item, myId, dateBasis);
      if (!inYmdRange(rowYmd, lo, hi)) return false;
      if (!q) return true;
      const num = item.inquiryNumber?.toLowerCase() ?? '';
      const memo = (item.scheduleMemo ?? '').toLowerCase();
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.customerPhone.toLowerCase().includes(q) ||
        memo.includes(q) ||
        `${item.address} ${item.addressDetail ?? ''}`.toLowerCase().includes(q) ||
        (num && num.includes(q))
      );
    });
    rows.sort((a, b) => {
      const ta = myAssignment(a, myId)?.assignedAt ?? '';
      const tb = myAssignment(b, myId)?.assignedAt ?? '';
      return tb.localeCompare(ta);
    });
    return rows;
  }, [items, myId, from, to, dateBasis, statusFilter, appliedSearch]);

  useEffect(() => {
    setListPage(1);
  }, [from, to, dateBasis, statusFilter, appliedSearch, preset]);

  useEffect(() => {
    setListPage((p) => clampListPage(p, filteredSorted.length, listPageSize));
  }, [filteredSorted.length, listPageSize]);

  const paginatedRows = useMemo(() => {
    const start = (listPage - 1) * listPageSize;
    return filteredSorted.slice(start, start + listPageSize);
  }, [filteredSorted, listPage, listPageSize]);

  const rangeLabelLo = from <= to ? from : to;
  const rangeLabelHi = from <= to ? to : from;

  if (loading) {
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
        <div className="mt-1 text-fluid-xs text-gray-500">
          <TeamBiLine id="team.assign.intro" koClassName="text-fluid-xs text-gray-500" />
        </div>
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

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-fluid-xs text-gray-600 min-w-0 sm:min-w-[9rem]">
            <TeamBiInline id="team.assign.dateBasis" />
            <select
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as DateBasis)}
              className="rounded border border-gray-300 px-2 py-2 text-fluid-sm bg-white"
            >
              <option value="assignedAt">{teamBiPlain('team.assign.basisAssigned')}</option>
              <option value="createdAt">{teamBiPlain('team.assign.basisCreated')}</option>
              <option value="preferredDate">{teamBiPlain('team.assign.basisPreferred')}</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-1">
            {DATE_RANGE_PRESET_LABELS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className={`rounded px-2.5 py-1.5 text-fluid-xs font-medium border touch-manipulation ${
                  preset === id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-fluid-sm">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5"
            />
            <span className="text-gray-500">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5"
            />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-fluid-xs text-gray-600 min-w-0 sm:w-40">
            <TeamBiInline id="team.assign.status" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-gray-300 px-2 py-2 text-fluid-sm bg-white"
            >
              <option value="">{teamBiPlain('team.common.all')}</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-1 min-w-0 flex-col gap-1 sm:max-w-md">
            <TeamBiLine id="team.assign.searchHint" koClassName="text-fluid-xs text-gray-600" />
            <div className="flex gap-2">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedSearch(searchInput);
                }}
                className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-2 text-fluid-sm"
                placeholder={teamBiPlain('team.assign.searchPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setAppliedSearch(searchInput)}
                className="shrink-0 rounded bg-gray-800 px-3 py-2 text-fluid-sm font-medium text-white"
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
        {filteredSorted.length === 0 ? (
          <div className="p-8 text-center text-fluid-sm text-gray-500">
            <TeamBiLine id="team.assign.empty" koClassName="text-fluid-sm text-gray-500" />
          </div>
        ) : (
          <>
            <p className="px-4 pt-3 text-fluid-xs text-gray-500 lg:hidden">
              <TeamBiLine id="team.assign.mobileHint" koClassName="text-fluid-xs text-gray-500" />
            </p>
            <p className="hidden px-4 pt-3 text-fluid-xs text-gray-500 lg:block sm:px-0">
              <TeamBiLine id="team.assign.desktopHint" koClassName="text-fluid-xs text-gray-500" />
            </p>

            <div className="flex flex-col gap-3 p-3 lg:hidden">
              {paginatedRows.map((item) => {
                const mine = myAssignment(item, myId!);
                const addr = `${item.address}${item.addressDetail ? ` ${item.addressDetail}` : ''}`.trim();
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
                        <p className="mt-1.5 line-clamp-2 text-fluid-xs leading-snug text-gray-600" title={addr}>
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
                      <TeamHappyCallBadge item={item} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-fluid-2xs text-gray-600" title={formatCrewInfo(item)}>
                      {formatCrewInfo(item)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:block">
            <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-fluid-sm border-collapse min-w-[920px]">
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
                      <TeamBiLine id="team.assign.thHappy" koClassName="text-fluid-xs font-medium text-gray-700" />
                    </th>
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
                    const pBorder = 'border-b border-gray-100';
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer group hover:bg-gray-50 active:bg-gray-100"
                        onClick={() => setDetailItem(item)}
                      >
                        <td
                          className={`align-middle py-2 px-2 text-gray-700 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-gray-50 ${pBorder}`}
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
                          title={`${item.address}${item.addressDetail ? ` ${item.addressDetail}` : ''}`}
                        >
                          {item.address}
                          {item.addressDetail ? ` ${item.addressDetail}` : ''}
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
                        <td className={`align-middle py-2 px-2 text-center ${pBorder}`}>
                          <TeamHappyCallBadge item={item} />
                        </td>
                        <td
                          className={`align-middle py-2 px-2 text-gray-600 text-center max-w-[120px] truncate ${pBorder}`}
                          title={coLeadersSummary(item, myId!)}
                        >
                          {coLeadersSummary(item, myId!)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SyncHorizontalScroll>
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-fluid-xs text-gray-600 sm:px-4 flex flex-wrap gap-x-4 gap-y-2 items-center">
              <TeamBiLine
                id="team.assign.footerRange"
                vars={{ from: rangeLabelLo, to: rangeLabelHi }}
                koClassName="text-fluid-xs text-gray-600"
              />
              {dateBasis === 'assignedAt' ? (
                <TeamBiInline id="team.assign.basisAssigned" />
              ) : dateBasis === 'createdAt' ? (
                <TeamBiInline id="team.assign.basisCreated" />
              ) : (
                <TeamBiInline id="team.assign.basisPreferred" />
              )}
            </div>
            <ListPaginationBar
              page={listPage}
              pageSize={listPageSize}
              total={filteredSorted.length}
              onPageChange={setListPage}
              onPageSizeChange={(size) => {
                setListPageSize(size);
                setListPage(1);
              }}
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
            await loadList();
          }}
          onHappyCallComplete={async () => {
            if (!token) return;
            await completeTeamHappyCall(token, detailItem.id);
            await loadList();
          }}
        />
      )}
    </div>
  );
}
