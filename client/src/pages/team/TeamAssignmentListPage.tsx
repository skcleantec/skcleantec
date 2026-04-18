import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  completeTeamHappyCall,
  getTeamHappyCallStats,
  getTeamInquiries,
  patchTeamInquiryPreferredDate,
} from '../../api/team';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { useNavigate } from 'react-router-dom';
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
  TeamHappyCallBadge,
  TeamInquiryDetailModal,
} from './teamInquiryShared';

function formatAreaLine(item: { areaBasis?: string | null; areaPyeong?: number | null }) {
  if (item.areaPyeong == null) return '-';
  const b = item.areaBasis?.trim();
  return b ? `${b} ${item.areaPyeong}평` : `${item.areaPyeong}평`;
}

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
    return u.externalCompany?.name ? `[타업체] ${u.externalCompany.name}` : `[타업체] ${u.name}`;
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
  return mine?.assignedAt ? toKstYmd(mine.assignedAt) : null;
}

function inYmdRange(ymd: string | null, from: string, to: string): boolean {
  if (!ymd) return false;
  return ymd >= from && ymd <= to;
}

export function TeamAssignmentListPage() {
  const token = getTeamToken();
  const navigate = useNavigate();
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

  const loadList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [me, inv, hc] = await Promise.all([
        getMe(token) as Promise<{ id: string }>,
        getTeamInquiries(token) as Promise<{ items: InquiryItem[] }>,
        getTeamHappyCallStats(token).catch(() => ({ overdueCount: 0, pendingBeforeDeadlineCount: 0 })),
      ]);
      setMyId(me.id);
      setItems(inv.items);
      setHappyStats(hc);
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        clearTeamToken();
        navigate('/login', { replace: true, state: { sessionExpired: true } });
        return;
      }
      setItems([]);
      setMyId(null);
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.customerPhone.toLowerCase().includes(q) ||
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

  const rangeLabelLo = from <= to ? from : to;
  const rangeLabelHi = from <= to ? to : from;

  if (loading) {
    return <div className="py-12 text-center text-gray-500 text-fluid-sm">로딩 중...</div>;
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">배정목록</h1>
        <p className="mt-1 text-fluid-xs text-gray-500">
          관리자가 본인에게 배정한 접수를 관리자 접수목록과 비슷한 표로 확인합니다. (다른 팀장으로 재배정되어 본인 배정이
          해제된 건은 DB에 남지 않아 이 목록에 나오지 않을 수 있습니다.)
        </p>
      </div>

      {(happyStats.overdueCount > 0 || happyStats.pendingBeforeDeadlineCount > 0) && (
        <div
          className={`rounded-xl border px-4 py-3 text-fluid-sm ${
            happyStats.overdueCount > 0
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          해피콜 미완:{' '}
          {happyStats.overdueCount > 0 && (
            <>
              마감 초과 <strong className="tabular-nums">{happyStats.overdueCount}</strong>건
            </>
          )}
          {happyStats.overdueCount > 0 && happyStats.pendingBeforeDeadlineCount > 0 && ' · '}
          {happyStats.pendingBeforeDeadlineCount > 0 && (
            <>
              마감 전 <strong className="tabular-nums">{happyStats.pendingBeforeDeadlineCount}</strong>건
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-fluid-xs text-gray-600 min-w-0 sm:min-w-[9rem]">
            기간 기준
            <select
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as DateBasis)}
              className="rounded border border-gray-300 px-2 py-2 text-fluid-sm bg-white"
            >
              <option value="assignedAt">배정일(본인)</option>
              <option value="createdAt">접수일</option>
              <option value="preferredDate">예약일</option>
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
            상태
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-gray-300 px-2 py-2 text-fluid-sm bg-white"
            >
              <option value="">전체</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-1 min-w-0 flex-col gap-1 sm:max-w-md">
            <span className="text-fluid-xs text-gray-600">검색 (고객명·연락처·주소·접수번호)</span>
            <div className="flex gap-2">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedSearch(searchInput);
                }}
                className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-2 text-fluid-sm"
                placeholder="검색어"
              />
              <button
                type="button"
                onClick={() => setAppliedSearch(searchInput)}
                className="shrink-0 rounded bg-gray-800 px-3 py-2 text-fluid-sm font-medium text-white"
              >
                조회
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
          <div className="p-8 text-center text-fluid-sm text-gray-500">조건에 맞는 배정이 없습니다.</div>
        ) : (
          <>
            <p className="text-fluid-xs text-gray-500 px-4 pt-3 sm:px-0 sm:pt-3 max-md:px-4">
              좁은 화면에서는 표를 좌우로 밀거나, 하단 고정 막대·◀▶로 가로 스크롤할 수 있습니다.
            </p>
            <SyncHorizontalScroll dockUntil="lg" contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-fluid-sm border-collapse min-w-[920px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                      배정일시
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">접수일·번호</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">배정자</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">고객</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">연락처</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 min-w-[88px]">주소</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">평수</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">방·화·베</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">예약일</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">시간대</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">상태</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">해피콜</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-700 whitespace-nowrap">공동 배정</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((item) => {
                    const mine = myAssignment(item, myId!);
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
                          {mine?.assignedBy?.name ?? '—'}
                        </td>
                        <td
                          className={`align-middle py-2 px-2 font-medium text-gray-900 text-center whitespace-nowrap ${pBorder}`}
                        >
                          {item.customerName}
                          {item.claimMemo ? (
                            <span className="ml-1 text-orange-600" title={item.claimMemo}>
                              ●
                            </span>
                          ) : null}
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
                          {formatAreaLine(item)}
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center whitespace-nowrap ${pBorder}`}>
                          {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center whitespace-nowrap ${pBorder}`}>
                          <span className="text-fluid-xs tabular-nums">
                            {formatDateCompactWithWeekday(item.preferredDate)}
                          </span>
                        </td>
                        <td className={`align-middle py-2 px-2 text-gray-600 text-center whitespace-nowrap ${pBorder}`}>
                          {item.preferredTime ? shortTimeSlotLabel(item.preferredTime) : '-'}
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
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-fluid-xs text-gray-600 sm:px-4">
              표시 {filteredSorted.length}건 · 기간 {rangeLabelLo} ~ {rangeLabelHi} ·{' '}
              {dateBasis === 'assignedAt' ? '배정일' : dateBasis === 'createdAt' ? '접수일' : '예약일'} 기준
            </div>
          </>
        )}
      </div>

      {detailItem && myId && (
        <TeamInquiryDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          enableHappyCall
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
