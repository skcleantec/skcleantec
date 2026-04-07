import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { getTeamLeaderMonthlyStats, type TeamLeaderMonthlyStatRow } from '../../api/teams';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { YearMonthSelect } from '../../components/ui/DateQuerySelects';

function kstMonthYm(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return `${y}년 ${m}월`;
}

function fmtCount(n: number): string {
  return Number(n).toLocaleString('ko-KR');
}

export function AdminTeamLeaderStatsPage() {
  const token = getToken();
  const [month, setMonth] = useState(() => kstMonthYm());
  const [rows, setRows] = useState<TeamLeaderMonthlyStatRow[]>([]);
  const [resolvedMonth, setResolvedMonth] = useState<string>(month);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTeamLeaderMonthlyStats(token, month);
      setResolvedMonth(data.month);
      setRows(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, month]);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token, load]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="block text-fluid-xs text-gray-600 mb-1">조회 월 (KST)</span>
          <YearMonthSelect
            value={month}
            onChange={setMonth}
            idPrefix="leader-stats"
            minYear={2020}
            maxYear={2040}
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-fluid-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      <p className="text-fluid-xs text-gray-600">
        예약일이 {formatMonthLabel(resolvedMonth)}에 속하는 접수 중, 해당 팀장에게 배정된 건을 집계합니다. 예약일이
        없는 접수는 제외됩니다.
      </p>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-fluid-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg min-w-0">
        <h2 className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium text-gray-800 text-fluid-sm">
          팀장별 실적 · {formatMonthLabel(resolvedMonth)}
        </h2>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-fluid-sm">로딩 중…</div>
        ) : rows.length === 0 && !error ? (
          <div className="p-8 text-center text-gray-500 text-fluid-sm">표시할 팀장이 없습니다.</div>
        ) : (
          <>
            <p className="border-b border-gray-100 px-4 pt-2 text-fluid-2xs text-gray-500 md:hidden">
              표는 좌우로 스크롤할 수 있습니다.
            </p>
            <SyncHorizontalScroll dockUntil="md" contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full border-collapse text-fluid-sm min-w-[520px]">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-100 border-r border-gray-200 px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">
                      팀장
                    </th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">배정</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">완료</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">미완료</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">취소</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.teamLeaderId} className="border-b border-gray-100 group hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-100 px-3 py-3 text-gray-900 whitespace-nowrap">
                        {r.name}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-800">{fmtCount(r.assigned)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-800">{fmtCount(r.completed)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-800">{fmtCount(r.incomplete)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-800">{fmtCount(r.cancelled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncHorizontalScroll>
          </>
        )}
      </div>
    </div>
  );
}
