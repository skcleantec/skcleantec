import { useState, useEffect, useCallback } from 'react';
import {
  getAdvertisingDailySettlement,
  type AdvertisingDailySettlementResponse,
} from '../../api/advertising';
import { ModalCloseButton } from './ModalCloseButton';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

function kstYmNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

type Props = {
  token: string;
  marketerId: string;
  marketerName: string;
  /** 광고비 집계 조회 기간의 시작 월(YYYY-MM). 없으면 KST 당월 */
  initialMonth?: string;
  onClose: () => void;
};

export function AdvertisingDailySettlementModal({
  token,
  marketerId,
  marketerName,
  initialMonth,
  onClose,
}: Props) {
  const [month, setMonth] = useState(() => initialMonth ?? kstYmNow());
  const [data, setData] = useState<AdvertisingDailySettlementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await getAdvertisingDailySettlement(token, month, marketerId);
      setData(r);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, month, marketerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.monthTotals;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col min-h-0">
        <ModalCloseButton onClick={onClose} />
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 pr-14 shrink-0">
          <h3 className="text-fluid-lg font-semibold text-gray-900">일별 정산 내역</h3>
          <p className="text-fluid-sm text-gray-600 mt-1">
            <span className="font-medium text-gray-800">{marketerName}</span> — 작업 종료일(KST) 기준으로 채널 입력 광고비와 예약
            분모를 일자별로 묶었습니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="ad-daily-month" className="text-fluid-xs text-gray-600">
              조회 월 (KST)
            </label>
            <input
              id="ad-daily-month"
              type="month"
              className="border border-gray-300 rounded px-2 py-1 text-fluid-sm tabular-nums"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button
              type="button"
              className="text-fluid-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
              onClick={() => void load()}
              disabled={loading}
            >
              다시 불러오기
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-5 py-3">
          {err && (
            <div className="mb-3 text-fluid-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>
          )}
          {loading ? (
            <p className="text-fluid-sm text-gray-500 py-6 text-center">불러오는 중…</p>
          ) : data ? (
            <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain -mx-5 px-5 sm:mx-0 sm:px-0">
              <table className="w-full text-fluid-sm min-w-[700px] border-collapse table-fixed">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[27%]" />
                </colgroup>
                <thead className="bg-gray-50 sticky top-0 z-[1]">
                  <tr>
                    <th className="text-center py-2 px-2 border-b border-gray-200">일자</th>
                    <th className="text-center py-2 px-2 border-b border-gray-200">광고비</th>
                    <th className="text-center py-2 px-2 border-b border-gray-200">예약 건수</th>
                    <th className="text-center py-2 px-2 border-b border-gray-200">취소</th>
                    <th className="text-center py-2 px-2 border-b border-gray-200">삭제</th>
                    <th
                      className="text-center py-2 px-2 border-b border-gray-200"
                      title="해당 일 광고비 ÷ 예약 건수. 광고비가 0이면 표시하지 않습니다."
                    >
                      건당 광고비
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((d) => (
                    <tr key={d.ymd} className="border-t border-gray-100 hover:bg-gray-50/80">
                      <td className="py-1.5 px-2 text-center text-fluid-xs truncate" title={d.ymd}>
                        {formatDateCompactWithWeekday(d.ymd)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-fluid-xs">{won(d.totalAdSpend)}</td>
                      <td className="py-1.5 px-2 text-center tabular-nums text-fluid-xs">{d.reservationCount}</td>
                      <td className="py-1.5 px-2 text-center tabular-nums text-fluid-xs text-rose-700">
                        {d.cancelledReservationCount > 0 ? d.cancelledReservationCount : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-center tabular-nums text-fluid-xs text-gray-600">
                        {d.deletedReservationCount > 0 ? d.deletedReservationCount : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-fluid-xs">
                        {d.costPerReservation != null ? won(Math.round(d.costPerReservation)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-medium">
                      <td className="py-2 px-2 text-center text-fluid-xs">합계 ({data.month})</td>
                      <td className="py-2 px-2 text-right tabular-nums text-fluid-xs">{won(totals.totalAdSpend)}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-fluid-xs">{totals.reservationCount}</td>
                      <td className="py-2 px-2 text-center tabular-nums text-fluid-xs text-rose-700">
                        {totals.cancelledReservationCount > 0 ? totals.cancelledReservationCount : '—'}
                      </td>
                      <td className="py-2 px-2 text-center tabular-nums text-fluid-xs text-gray-600">
                        {totals.deletedReservationCount > 0 ? totals.deletedReservationCount : '—'}
                      </td>
                      <td
                        className="py-2 px-2 text-right tabular-nums text-fluid-xs"
                        title="총 광고비 ÷ 총 예약 건수 (광고비 집계의 건당 비용과 동일. 일별 건당의 단순 평균과는 다를 수 있습니다)"
                      >
                        {totals.costPerReservation != null ? won(Math.round(totals.costPerReservation)) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
              <p className="text-fluid-2xs text-gray-500 mt-2 leading-snug">
                예약 건수는 취소·삭제를 제외한 분모입니다. 취소·삭제 열은 같은 세션 구간에서 빠진 건수(참고용)입니다.
              </p>
              <p className="text-fluid-2xs text-gray-500 mt-1 leading-snug">
                합계 건당 광고비는 <strong className="font-medium text-gray-600">총 광고비 ÷ 총 예약 건수</strong>입니다.
                광고비 집계 화면의 「건당 비용」과 같은 방식이며, 일별 건당 열을 단순 평균한 값과는 다를 수 있습니다.
              </p>
              <p className="text-fluid-2xs text-gray-500 mt-1 leading-snug lg:hidden">
                좁은 화면에서는 표를 좌우로 스크롤할 수 있습니다.
              </p>
            </div>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex justify-end">
          <button
            type="button"
            className="px-3 py-1.5 text-fluid-sm border border-gray-300 rounded hover:bg-gray-50"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
