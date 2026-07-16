import { useCallback, useEffect, useRef, useState } from 'react';
import { searchScheduleInquiries, type ScheduleSearchHit } from '../../api/schedule';
import { addressListShortSiGu, inquiryPrimaryCustomerLabel } from '../../utils/inquiryListDisplay';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { shortTimeSlotLabel } from '../../constants/orderFormSchedule';

export type ScheduleInquirySearchPanelProps = {
  token: string;
  onPick: (item: ScheduleSearchHit) => void;
  /** 모바일 시트 등 — 선택 후 닫기 */
  onAfterPick?: () => void;
  className?: string;
};

export function ScheduleInquirySearchPanel({
  token,
  onPick,
  onAfterPick,
  className = '',
}: ScheduleInquirySearchPanelProps) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ScheduleSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestGenRef = useRef(0);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setItems([]);
        setError(null);
        setLoading(false);
        return;
      }
      const rid = ++requestGenRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await searchScheduleInquiries(token, trimmed, { limit: 20 });
        if (requestGenRef.current !== rid) return;
        setItems(res.items);
      } catch {
        if (requestGenRef.current !== rid) return;
        setItems([]);
        setError('검색에 실패했습니다.');
      } finally {
        if (requestGenRef.current === rid) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(input);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, runSearch]);

  const handlePick = (item: ScheduleSearchHit) => {
    onPick(item);
    onAfterPick?.();
  };

  const showResults = input.trim().length >= 2;

  return (
    <div className={className}>
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 border-b border-slate-100 px-2.5 py-2">
          <h2 className="font-semibold text-slate-900 text-[12px] leading-tight">접수 검색</h2>
          <p className="mt-0.5 text-[10px] text-slate-400 leading-tight">고객명 · 전화 · 접수번호 · 주소</p>
        </div>
        <div className="px-2.5 py-2">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (debounceRef.current) clearTimeout(debounceRef.current);
                void runSearch(input);
              }
            }}
            placeholder="2자 이상 입력"
            autoComplete="off"
            className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            aria-label="스케줄 접수 검색"
          />
          {showResults ? (
            <div className="mt-2 min-w-0">
              {loading ? (
                <p className="py-2 text-center text-[11px] text-slate-500">검색 중…</p>
              ) : error ? (
                <p className="py-2 text-center text-[11px] text-rose-600">{error}</p>
              ) : items.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-slate-500">검색 결과가 없습니다.</p>
              ) : (
                <ul
                  className="max-h-[min(40vh,16rem)] space-y-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
                  role="listbox"
                  aria-label="검색 결과"
                >
                  {items.map((item) => {
                    const label = inquiryPrimaryCustomerLabel(item);
                    const addr = addressListShortSiGu(item.address);
                    const dateLabel = item.preferredDate
                      ? formatDateCompactWithWeekday(item.preferredDate.slice(0, 10))
                      : '예약일 없음';
                    const timeLabel = item.preferredTime
                      ? shortTimeSlotLabel(item.preferredTime)
                      : null;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          onClick={() => handlePick(item)}
                          className="flex w-full min-w-0 flex-col rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-left hover:border-sky-200 hover:bg-sky-50/60 active:bg-sky-100/50 touch-manipulation"
                        >
                          <span className="truncate text-[11px] font-semibold text-slate-900" title={label}>
                            {label}
                            {item.inquiryNumber ? (
                              <span className="ml-1 font-mono text-[10px] font-medium text-slate-500 tabular-nums">
                                {item.inquiryNumber}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 truncate text-[10px] text-slate-600" title={item.customerPhone}>
                            {item.customerPhone}
                            {addr ? ` · ${addr}` : ''}
                          </span>
                          <span className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                            {dateLabel}
                            {timeLabel ? ` · ${timeLabel}` : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
