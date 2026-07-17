import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../../../stores/auth';
import {
  fetchTelecrmCallSessionTeamSummary,
  type TelecrmCallSessionTeamRowDto,
} from '../../../../api/telecrm';
import { computeDateRangeFromPreset, type DateRangePresetId } from '../../../../utils/dateRangePresets';
import { resolveEffectiveStaffAdminFromMe } from '../../../../utils/staffAdminAccess';
import { useAdminStaffSession } from '../../../../hooks/useAdminStaffSession';
import { ListPaginationBar } from '../../../../components/ui/ListPaginationBar';
import { INQUIRY_LIST_DEFAULT_PAGE_SIZE, type InquiryListPageSize } from '../../../../utils/listPagination';

function formatDuration(sec: number): string {
  if (sec <= 0) return '0분';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function kstTodayYmd(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const PRESETS: { id: DateRangePresetId; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: 'thisMonth', label: '이번 달' },
  { id: 'lastMonth', label: '지난 달' },
  { id: 'custom', label: '직접 선택' },
];

export function TelecrmCallActivityPage() {
  const token = getToken();
  const { staffMe } = useAdminStaffSession();
  const isAdmin = resolveEffectiveStaffAdminFromMe(staffMe);
  const [preset, setPreset] = useState<DateRangePresetId>('today');
  const [from, setFrom] = useState(kstTodayYmd());
  const [to, setTo] = useState(kstTodayYmd());
  const [items, setItems] = useState<TelecrmCallSessionTeamRowDto[]>([]);
  const [connectedMinSec, setConnectedMinSec] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<InquiryListPageSize>(INQUIRY_LIST_DEFAULT_PAGE_SIZE);

  const applyPreset = useCallback((next: DateRangePresetId) => {
    setPreset(next);
    const range = computeDateRangeFromPreset(next);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
    }
    setPage(1);
  }, []);

  useEffect(() => {
    applyPreset('today');
  }, [applyPreset]);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmCallSessionTeamSummary(token, from, to);
      setItems(res.items);
      setConnectedMinSec(res.connectedMinSec);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회에 실패했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, row) => ({
        connected: acc.connected + row.connectedCount,
        noAnswer: acc.noAnswer + row.noAnswerCount,
        duration: acc.duration + row.connectedDurationSec,
      }),
      { connected: 0, noAnswer: 0, duration: 0 },
    );
  }, [items]);

  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
        관리자만 상담사 통화 현황을 볼 수 있습니다.
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">상담 통화 현황</h2>
        <p className="mt-1 text-fluid-sm text-gray-500">
          CallLog 기준 · {connectedMinSec}초 이상만 연결 통화로 집계합니다.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-fluid-xs font-medium ${
                preset === p.id ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="text-[11px] text-slate-500">팀 연결</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{totals.connected}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="text-[11px] text-slate-500">팀 미연결</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{totals.noAnswer}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center col-span-2 sm:col-span-2">
            <div className="text-[11px] text-slate-500">팀 연결 시간</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{formatDuration(totals.duration)}</div>
          </div>
        </div>
      </div>

      <ListPaginationBar
        mode="summary"
        page={page}
        pageSize={pageSize}
        total={items.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-fluid-xs xl:text-fluid-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-2 py-2 text-center font-medium">상담사</th>
                <th className="px-2 py-2 text-center font-medium">연결</th>
                <th className="px-2 py-2 text-center font-medium">미연결</th>
                <th className="px-2 py-2 text-center font-medium">연결시간</th>
                <th className="px-2 py-2 text-center font-medium">평균통화</th>
                <th className="px-2 py-2 text-center font-medium">마지막 연결</th>
                <th className="px-2 py-2 text-center font-medium">평균 간격</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">불러오는 중…</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-red-600">{error}</td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">표시할 통화 기록이 없습니다.</td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr key={row.userId} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2 text-center truncate" title={row.loginId ?? undefined}>
                      {row.userName ?? row.loginId ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.connectedCount}</td>
                    <td className="px-2 py-2 text-center tabular-nums text-gray-500">{row.noAnswerCount}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{formatDuration(row.connectedDurationSec)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {row.avgConnectedDurationSec > 0 ? formatDuration(row.avgConnectedDurationSec) : '—'}
                    </td>
                    <td className="px-2 py-2 text-center text-fluid-2xs">{formatWhen(row.lastConnectedAt)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {row.avgGapMin != null ? `${row.avgGapMin}분` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading ? (
        <ListPaginationBar
          mode="nav"
          page={page}
          pageSize={pageSize}
          total={items.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      ) : null}
    </div>
  );
}
