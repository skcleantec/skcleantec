import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getMarketerDailyOverview, type MarketerDailyOverviewResponse } from '../../api/inquiries';
import { ModalCloseButton } from './ModalCloseButton';

function formatMonthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return `${y}년 ${m}월`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MarketerDailyInquiryModal(props: {
  open: boolean;
  onClose: () => void;
  authToken: string | null;
  marketerId: string | null;
  marketerName: string;
  initialMonthKey: string;
}) {
  const { open, onClose, authToken, marketerId, marketerName, initialMonthKey } = props;
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MarketerDailyOverviewResponse | null>(null);

  useEffect(() => {
    if (open) setMonthKey(initialMonthKey);
  }, [open, initialMonthKey, marketerId]);

  const load = useCallback(async () => {
    if (!authToken || !marketerId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getMarketerDailyOverview(authToken, { marketerId, month: monthKey });
      setData(r);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [authToken, marketerId, monthKey]);

  useEffect(() => {
    if (!open || !authToken || !marketerId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }
    void load();
  }, [open, authToken, marketerId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(92vh,44rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketer-daily-inquiry-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-4 pr-14">
          <h2 id="marketer-daily-inquiry-title" className="text-base font-semibold text-gray-900">
            일별 접수 건수
          </h2>
          <p className="mt-1 text-fluid-xs text-gray-600">{marketerName}</p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setMonthKey((mk) => shiftMonthKey(mk, -1))}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50"
            aria-label="이전 달"
          >
            ◀ 이전
          </button>
          <span className="text-fluid-sm font-semibold text-gray-900 tabular-nums">
            {formatMonthKeyLabel(monthKey)}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((mk) => shiftMonthKey(mk, 1))}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50"
            aria-label="다음 달"
          >
            다음 ▶
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!authToken ? (
            <p className="text-fluid-sm text-gray-600">로그인이 필요합니다.</p>
          ) : loading ? (
            <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
          ) : error ? (
            <div className="text-fluid-sm">
              <p className="text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 text-gray-700 underline hover:text-gray-900"
              >
                다시 시도
              </button>
            </div>
          ) : data ? (
            <div className="space-y-3">
              <p className="text-fluid-xs text-gray-600">
                발주서 제출일·전화·수기 접수일(한국 시간) 기준 · 월 합계{' '}
                <span className="font-semibold tabular-nums text-gray-900">{data.monthTotal}건</span>
              </p>
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <table className="w-full border-collapse text-fluid-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                      <th className="py-2 px-3 text-center font-medium">날짜</th>
                      <th className="py-2 px-3 text-center font-medium">건수</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-900">
                    {data.dailyCounts.map((count, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 last:border-0 ${
                          count > 0 ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td className="py-1.5 px-3 text-center tabular-nums">{i + 1}일</td>
                        <td
                          className={`py-1.5 px-3 text-right tabular-nums ${
                            count > 0 ? 'font-medium' : 'text-gray-500'
                          }`}
                        >
                          {count}건
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
