import { useState, useMemo } from 'react';
import { getToken } from '../../stores/auth';
import { getExternalSettlementSummary } from '../../api/externalCompanies';
import { kstTodayYmd } from '../../utils/dateFormat';

function monthStartEndYmd(todayYmd: string): { from: string; to: string } {
  const y = todayYmd.slice(0, 7);
  const [yy, mm] = y.split('-').map(Number);
  const last = new Date(yy, mm, 0).getDate();
  return { from: `${y}-01`, to: `${y}-${String(last).padStart(2, '0')}` };
}

export function AdminExternalSettlementPage() {
  const token = getToken();
  const defaultRange = useMemo(() => monthStartEndYmd(kstTodayYmd()), []);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getExternalSettlementSummary>> | null>(null);

  const run = async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await getExternalSettlementSummary(token, from, to);
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '집계 실패');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">타업체 정산</h1>
        <p className="text-sm text-gray-500 mt-1">
          예약일(희망일)이 기간 안에 있고, <strong className="font-medium text-gray-700">타업체 넘김 금액</strong>이
          입력된 접수만 집계합니다. 업체별 합계는 해당 건에 타업체 담당이 배정된 경우에만 행으로 잡힙니다.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg p-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">시작일</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">종료일</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || !token}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '집계 중…' : '집계'}
        </button>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>}

      {data && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap justify-between gap-2">
            <span className="text-sm text-gray-600">
              기간: {data.from} ~ {data.to}
            </span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">
              합계 {data.grandTotal.toLocaleString('ko-KR')}원
            </span>
          </div>
          {data.rows.length === 0 && !data.unassigned ? (
            <div className="p-8 text-center text-gray-500 text-sm">해당 기간에 집계할 건이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-2 font-medium">타업체</th>
                    <th className="px-4 py-2 font-medium">건수</th>
                    <th className="px-4 py-2 font-medium">넘김 금액 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.externalCompanyId} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-900">{r.companyName}</td>
                      <td className="px-4 py-2 tabular-nums">{r.inquiryCount}</td>
                      <td className="px-4 py-2 tabular-nums">{r.feeSum.toLocaleString('ko-KR')}원</td>
                    </tr>
                  ))}
                  {data.unassigned && (
                    <tr className="border-t border-gray-100 bg-amber-50/50">
                      <td className="px-4 py-2 text-amber-900">
                        업체 미매칭 (금액만 있고 타업체 배정 없음)
                      </td>
                      <td className="px-4 py-2 tabular-nums">{data.unassigned.inquiryCount}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {data.unassigned.feeSum.toLocaleString('ko-KR')}원
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
