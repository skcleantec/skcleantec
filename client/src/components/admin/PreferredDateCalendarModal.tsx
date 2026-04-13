import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import { kstTodayYmd, weekdayKoFromYmd } from '../../utils/dateFormat';
import { isPublicHoliday } from '../../utils/holidays';
import { ModalCloseButton } from './ModalCloseButton';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const remainder = days.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) days.push(null);
  }
  return days;
}

function isFullDayClosure(s: ScheduleStatsByDate | undefined): boolean {
  if (!s) return false;
  if (s.closureScope === 'FULL') return true;
  if (s.closureScope === 'MORNING' || s.closureScope === 'AFTERNOON') return false;
  return Boolean(s.manualClosed);
}

/** 스케줄 표와 동일: 팀장 오전·오후 슬롯에 분배 잔여가 있는 날 */
function hasAssignableLeaderSlots(s: ScheduleStatsByDate | undefined): boolean {
  if (!s) return false;
  if (isFullDayClosure(s)) return false;
  const am = s.assignableMorning ?? 0;
  const pm = s.assignableAfternoonSlot ?? 0;
  return am > 0 || pm > 0;
}

function parseYmdHint(s: string | undefined): { y: number; m: number } | null {
  const t = (s || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m };
}

function isTodayKstCell(year: number, month: number, day: number): boolean {
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return key === kstTodayYmd();
}

export type PreferredDateCalendarModalProps = {
  open: boolean;
  onClose: () => void;
  token: string;
  /** 열릴 때 달 초기 월(YYYY-MM-DD 중 앞부분만 사용) */
  initialYmd?: string;
  onSelect: (ymd: string) => void;
  minYear?: number;
  maxYear?: number;
};

export function PreferredDateCalendarModal({
  open,
  onClose,
  token,
  initialYmd,
  onSelect,
  minYear = 2020,
  maxYear = 2040,
}: PreferredDateCalendarModalProps) {
  const [year, setYear] = useState(() => {
    const p = parseYmdHint(initialYmd);
    if (p) return Math.min(maxYear, Math.max(minYear, p.y));
    return Number(kstTodayYmd().slice(0, 4));
  });
  const [month, setMonth] = useState(() => {
    const p = parseYmdHint(initialYmd);
    if (p) return p.m;
    return Number(kstTodayYmd().slice(5, 7));
  });
  const [stats, setStats] = useState<Record<string, ScheduleStatsByDate>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const p = parseYmdHint(initialYmd);
    if (p) {
      setYear(Math.min(maxYear, Math.max(minYear, p.y)));
      setMonth(p.m);
    } else {
      const k = kstTodayYmd();
      setYear(Math.min(maxYear, Math.max(minYear, Number(k.slice(0, 4)))));
      setMonth(Number(k.slice(5, 7)));
    }
  }, [open, initialYmd, minYear, maxYear]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);
    const { start, end } = getMonthRange(year, month);
    getScheduleStats(token, start, end)
      .then((r) => {
        if (!cancelled) {
          setStats(r.byDate);
          setStatsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatsError('스케줄 현황을 불러오지 못했습니다. 날짜는 선택할 수 있으나 표시가 제한됩니다.');
          setStats({});
          setStatsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, year, month]);

  if (!open) return null;

  const calendarDays = getCalendarDays(year, month);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const goPrevMonth = () => {
    if (month <= 1) {
      setYear((y) => Math.max(minYear, y - 1));
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month >= 12) {
      setYear((y) => Math.min(maxYear, y + 1));
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  const handlePick = (key: string) => {
    onSelect(key);
    onClose();
  };

  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal
      aria-labelledby="pref-cal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200 max-h-[min(90vh,40rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="p-4 sm:p-5 pr-12 border-b border-gray-100">
          <h2 id="pref-cal-title" className="text-base font-semibold text-gray-900">
            예약일 선택
          </h2>
          <p className="text-fluid-xs text-gray-500 mt-1 leading-relaxed">
            스케줄 표와 동일한 기준으로, 팀장 오전·오후 슬롯에 분배 잔여가 있는 날은 초록색으로 표시됩니다. 사정상 다른 날이 필요하면
            회색 날짜도 눌러 선택할 수 있습니다.
          </p>
        </div>

        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-stretch rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={goPrevMonth}
                className="px-2 py-2 text-gray-600 hover:bg-gray-50 border-r border-gray-200"
                aria-label="이전 달"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={goNextMonth}
                className="px-2 py-2 text-gray-600 hover:bg-gray-50"
                aria-label="다음 달"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-fluid-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-fluid-sm min-w-[5rem]"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>

          {statsError && (
            <div className="mb-2 text-fluid-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              {statsError}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-100/90 p-px overflow-hidden">
            <div className="grid grid-cols-7 gap-px bg-gray-200/90 text-left">
              {WEEKDAYS.map((w, wi) => (
                <div
                  key={w}
                  className={`py-1 px-0.5 text-center text-[10px] sm:text-fluid-2xs font-semibold bg-gray-50 ${
                    wi === 0 ? 'text-rose-600' : wi === 6 ? 'text-slate-600' : 'text-gray-600'
                  }`}
                >
                  {w}
                </div>
              ))}
              {statsLoading ? (
                <div className="col-span-7 py-10 text-center text-fluid-sm text-gray-500 bg-white">불러오는 중…</div>
              ) : (
                calendarDays.map((d, i) => {
                  if (d === null) {
                    return <div key={`e-${i}`} className="min-h-[3.25rem] bg-gray-50/80" />;
                  }
                  const key = getDateKey(d);
                  const st = stats[key];
                  const assignable = hasAssignableLeaderSlots(st);
                  const full = st != null && !assignable && !statsError;
                  const isSat = i % 7 === 6;
                  const isSun = i % 7 === 0;
                  const isHol = isPublicHoliday(year, month, d);
                  const today = isTodayKstCell(year, month, d);
                  const wdCls = isHol || isSun ? 'text-rose-600' : isSat ? 'text-slate-600' : 'text-gray-600';

                  const currentPreferred = (initialYmd || '').trim().slice(0, 10) === key;

                  let cellBg = 'bg-white hover:bg-gray-50';
                  if (assignable) cellBg = 'bg-emerald-50/90 hover:bg-emerald-100/90 border-emerald-200/80';
                  else if (full) cellBg = 'bg-slate-100/95 hover:bg-slate-200/80';

                  const am = st?.assignableMorning ?? 0;
                  const pm = st?.assignableAfternoonSlot ?? 0;
                  const cr = st?.crewRemaining;
                  const titleParts = [
                    assignable ? '분배 가능 (팀장 슬롯 잔여)' : full ? '팀장 슬롯 없음·마감에 가까움' : '현황 없음',
                    `오전 잔여 ${am}`,
                    `오후 잔여 ${pm}`,
                  ];
                  if (cr != null) titleParts.push(`팀원 잔여 ${cr}명`);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePick(key)}
                      title={titleParts.join(' · ')}
                      className={`min-h-[3.25rem] px-0.5 py-1 text-left text-fluid-2xs leading-tight border border-transparent ${cellBg} ${
                        currentPreferred ? 'ring-2 ring-gray-900 ring-inset z-[1]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-0.5">
                        <span
                          className={
                            today
                              ? 'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white'
                              : 'text-fluid-xs font-semibold text-gray-900 tabular-nums'
                          }
                        >
                          {d}
                        </span>
                        <span className={`font-medium ${wdCls}`}>{weekdayKoFromYmd(year, month, d)}</span>
                      </div>
                      {st && !statsError && (
                        <div className="mt-0.5 tabular-nums text-[9px] sm:text-[10px] text-gray-600">
                          <span className="text-amber-900/90">오{am}</span>
                          <span className="text-gray-400 mx-px">/</span>
                          <span className="text-sky-900/90">후{pm}</span>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-fluid-2xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 border border-emerald-300 shrink-0" />
              분배 가능
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-200 shrink-0" />
              슬롯 없음
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-900 shrink-0" />
              오늘(KST)
            </span>
          </div>
        </div>
      </div>
    </div>,
    root
  );
}
