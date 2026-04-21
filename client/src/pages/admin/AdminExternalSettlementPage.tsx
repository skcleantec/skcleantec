import { useState, useMemo, useEffect, useCallback } from 'react';
import { getToken } from '../../stores/auth';
import {
  getExternalSettlementSummary,
  getExternalFeeAccruals,
  postExternalFeeAccrualReset,
} from '../../api/externalCompanies';
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

  const [accLoading, setAccLoading] = useState(false);
  const [accErr, setAccErr] = useState<string | null>(null);
  const [accruals, setAccruals] = useState<Awaited<ReturnType<typeof getExternalFeeAccruals>> | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const loadAccruals = useCallback(async () => {
    if (!token) return;
    setAccLoading(true);
    setAccErr(null);
    try {
      const r = await getExternalFeeAccruals(token);
      setAccruals(r);
    } catch (e) {
      setAccErr(e instanceof Error ? e.message : '누계 로드 실패');
      setAccruals(null);
    } finally {
      setAccLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAccruals();
  }, [loadAccruals]);

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

  const handleResetAccrual = async (externalCompanyId: string, companyName: string) => {
    if (!token) return;
    const ok = window.confirm(
      `「${companyName}」 수수료 누계를 초기화할까요?\n실제 정산을 마친 뒤 누르세요. 이후 새로 입력·수정된 수수료만 다시 누적됩니다.`
    );
    if (!ok) return;
    setResettingId(externalCompanyId);
    setAccErr(null);
    try {
      await postExternalFeeAccrualReset(token, externalCompanyId);
      await loadAccruals();
    } catch (e) {
      setAccErr(e instanceof Error ? e.message : '초기화 실패');
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">타업체 정산</h1>
        <p className="text-sm text-gray-500 mt-1">
          예약일(희망일)이 기간 안에 있고, <strong className="font-medium text-gray-700">타업체 수수료</strong>가 입력된
          접수를 집계합니다. <strong className="font-medium text-gray-700">보류</strong>는 제외하고,{' '}
          <strong className="font-medium text-gray-700">취소</strong> 건은 같은 기간·업체 기준으로 수수료를
          차감(마이너스)합니다. 업체별 행은 타업체 담당(또는 취소 시 스냅샷 업체)이 있는 건만 포함됩니다.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/90">
          <h2 className="text-sm font-semibold text-gray-800">업체별 수수료 누계</h2>
          <p className="text-xs text-gray-600 mt-1">
            마지막 <strong className="font-medium text-gray-700">정산완료</strong> 시각 이후에 등록되거나 수정된
            접수만 구간 합계에 포함됩니다. 오늘·이번 달·올해는 <strong>예약일(KST)</strong> 기준입니다. 타업체
            담당 배정과 수수료가 모두 있는 건만 합산합니다.
          </p>
        </div>
        {accErr && <div className="text-sm text-red-700 bg-red-50 border-b border-red-100 px-4 py-2">{accErr}</div>}
        {accLoading && !accruals ? (
          <div className="p-8 text-center text-gray-500 text-sm">누계 불러오는 중…</div>
        ) : accruals && accruals.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 타업체가 없습니다.</div>
        ) : accruals ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-2 font-medium">타업체</th>
                  <th className="px-4 py-2 font-medium">마지막 정산완료</th>
                  <th className="px-4 py-2 font-medium">구간 합계</th>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">오늘 ({accruals.todayYmd})</th>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">이번 달 ({accruals.monthKey})</th>
                  <th className="px-4 py-2 font-medium whitespace-nowrap">올해 ({accruals.year})</th>
                  <th className="px-4 py-2 font-medium w-28 text-center">정산</th>
                </tr>
              </thead>
              <tbody>
                {accruals.items.map((r) => (
                  <tr key={r.externalCompanyId} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{r.companyName}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs tabular-nums">
                      {r.lastResetAt
                        ? new Date(r.lastResetAt).toLocaleString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{r.sinceResetTotal.toLocaleString('ko-KR')}원</td>
                    <td className="px-4 py-2 tabular-nums">{r.todayTotal.toLocaleString('ko-KR')}원</td>
                    <td className="px-4 py-2 tabular-nums">{r.monthTotal.toLocaleString('ko-KR')}원</td>
                    <td className="px-4 py-2 tabular-nums">{r.yearTotal.toLocaleString('ko-KR')}원</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        disabled={!token || resettingId === r.externalCompanyId}
                        onClick={() => void handleResetAccrual(r.externalCompanyId, r.companyName)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {resettingId === r.externalCompanyId ? '처리 중…' : '정산완료'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-800 mb-2">기간별 수수료 집계</h2>
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
                    <th className="px-4 py-2 font-medium">진행 건수</th>
                    <th className="px-4 py-2 font-medium">취소 차감</th>
                    <th className="px-4 py-2 font-medium">수수료 순액</th>
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
                      <td className="px-4 py-2 text-amber-900">업체 미매칭 (수수료만 있고 타업체 배정 없음)</td>
                      <td className="px-4 py-2 tabular-nums">{data.unassigned.inquiryCount}</td>
                      <td className="px-4 py-2 tabular-nums text-rose-800">
                        {(data.unassigned.cancelledInquiryCount ?? 0) > 0
                          ? `${data.unassigned.cancelledInquiryCount}건`
                          : '—'}
                      </td>
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
