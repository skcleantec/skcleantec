import { useState, useEffect, useCallback } from 'react';
import { getSchedule, type ScheduleItem } from '../../api/schedule';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import { getTeamLeaders, type UserItem } from '../../api/users';
import { getAllProfessionalOptions, type ProfessionalSpecialtyOptionDto } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import { isPublicHoliday } from '../../utils/holidays';
import { ScheduleInquiryDetailModal } from '../../components/admin/ScheduleInquiryDetailModal';
import { ProfessionalOptionDots } from '../../components/admin/ProfessionalOptionDots';
import { formatDateCompactWithWeekday, weekdayKoFromYmd } from '../../utils/dateFormat';
import { getScheduleTimeBucket } from '../../utils/scheduleTimeBucket';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: toDateKey(start),
    end: toDateKey(end),
  };
}

/** 주소 문자열에서 행정구역 시·구(또는 군)까지만 추출 */
function shortSiGuFromAddress(address: string): string {
  const parts = address.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const acc: string[] = [];
  for (const p of parts) {
    acc.push(p);
    if (p.length >= 2 && /(?:구|군)$/.test(p)) break;
  }
  if (acc.length >= 1 && /(?:구|군)$/.test(acc[acc.length - 1]!)) {
    return acc.join(' ');
  }
  return parts.slice(0, Math.min(2, parts.length)).join(' ');
}

function formatPyeongDisplay(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (Number.isInteger(r)) return `${Math.round(n)}평`;
  return `${r}평`;
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

function ScheduleDayListItem({
  item,
  profCatalog,
  onPick,
}: {
  item: ScheduleItem;
  profCatalog: ProfessionalSpecialtyOptionDto[];
  onPick: () => void;
}) {
  const isPending = item.status === 'PENDING';
  const bucket = getScheduleTimeBucket(item);
  const slotAccent =
    bucket === 'morning'
      ? 'border-l-[6px] border-amber-500 bg-amber-50/50'
      : bucket === 'afternoon'
        ? 'border-l-[6px] border-sky-600 bg-sky-50/50'
        : 'border-l-[6px] border-violet-500 bg-violet-50/40';
  const slotBadgeClass =
    bucket === 'morning'
      ? 'bg-amber-200/90 text-amber-950 border border-amber-400'
      : bucket === 'afternoon'
        ? 'bg-sky-200/90 text-sky-950 border border-sky-500'
        : 'bg-violet-100 text-violet-950 border border-violet-300';
  const slotLabelShort =
    bucket === 'morning' ? '오전' : bucket === 'afternoon' ? '오후' : '기타';
  const timeTeamLine = `${slotLabelShort} · ${item.assignments[0]?.teamLeader?.name ?? '미배정'}`;

  return (
    <button
      type="button"
      onClick={onPick}
      className={`text-left w-full py-1.5 px-2 rounded-md flex gap-1.5 border border-gray-200/90 shadow-sm text-fluid-sm ${slotAccent} ${
        isPending ? 'ring-1 ring-red-500' : ''
      } hover:brightness-[0.99]`}
    >
      <span
        className={`shrink-0 self-center inline-flex items-center justify-center min-w-[2.25rem] px-1 py-0.5 text-fluid-2xs font-bold leading-none rounded ${slotBadgeClass}`}
      >
        {slotLabelShort}
      </span>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="font-medium text-gray-900 min-w-0 inline-flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{item.customerName}</span>
            {item.inquiryNumber ? (
              <span className="text-[10px] sm:text-fluid-2xs font-normal text-gray-400 tabular-nums shrink-0">
                {item.inquiryNumber}
              </span>
            ) : null}
            <ProfessionalOptionDots rawIds={item.professionalOptionIds} catalog={profCatalog} />
          </span>
          {isPending && (
            <span className="text-fluid-2xs font-semibold text-red-700 shrink-0">대기</span>
          )}
        </div>
        <p className="text-fluid-xs text-gray-600 leading-snug truncate">
          {shortSiGuFromAddress(item.address)}
          {item.areaPyeong != null && item.areaPyeong > 0
            ? ` / ${formatPyeongDisplay(item.areaPyeong)}`
            : ''}
          <span className="text-gray-400"> · </span>
          {timeTeamLine}
        </p>
      </div>
    </button>
  );
}

function CirclePlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

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

/** 브라우저 로컬 날짜 기준 오늘 여부 */
function isTodayYmd(year: number, month: number, day: number): boolean {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() + 1 === month && t.getDate() === day;
}

export function AdminSchedulePage() {
  const token = getToken();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [stats, setStats] = useState<Record<string, ScheduleStatsByDate>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<ScheduleItem | null>(null);
  /** 신규 접수 모달 — 선택한 캘린더 날짜로 예약일 고정 */
  const [createInquiryModalDate, setCreateInquiryModalDate] = useState<string | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [profCatalog, setProfCatalog] = useState<ProfessionalSpecialtyOptionDto[]>([]);

  const fetchMonthData = useCallback(
    (showLoading: boolean) => {
      if (!token) return Promise.resolve();
      if (showLoading) setLoading(true);
      const { start, end } = getMonthRange(year, month);
      return Promise.all([
        getSchedule(token, start, end),
        getScheduleStats(token, start, end),
      ])
        .then(([scheduleRes, statsRes]) => {
          setItems(scheduleRes.items);
          setStats(statsRes.byDate);
          setLoadError(null);
        })
        .catch((err) => {
          setItems([]);
          setStats({});
          setLoadError(err instanceof Error ? err.message : '스케줄을 불러오지 못했습니다.');
        })
        .finally(() => {
          if (showLoading) setLoading(false);
        });
    },
    [token, year, month]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMonthData(true);
    });
  }, [fetchMonthData]);

  useEffect(() => {
    if (!token) return;
    getTeamLeaders(token).then(setTeamLeaders).catch(() => setTeamLeaders([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getAllProfessionalOptions(token)
      .then(setProfCatalog)
      .catch(() => setProfCatalog([]));
  }, [token]);

  const byDate = items.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const key = item.preferredDate ? item.preferredDate.slice(0, 10) : 'no-date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const calendarDays = getCalendarDays(year, month);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const goPrevMonth = () => {
    if (month <= 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month >= 12) {
      setYear((y) => y + 1);
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

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-fluid-lg font-semibold text-gray-900 tracking-tight">스케줄 표</h1>
          <p className="text-fluid-sm text-gray-500 mt-0.5">월별 배정·슬롯 현황을 한눈에 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-stretch rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={goPrevMonth}
              className="px-2.5 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-r border-gray-200"
              aria-label="이전 달"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="px-2.5 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              aria-label="다음 달"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-fluid-sm bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300/80"
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
            className="px-3 py-2 border border-gray-200 rounded-lg text-fluid-sm bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300/80 min-w-[5.5rem]"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-fluid-sm text-red-700">{loadError}</div>
      )}
      {loading ? (
        <div className="py-12 text-center text-gray-500 text-fluid-sm">로딩 중...</div>
      ) : (
        <>
          {/* 범례 */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-fluid-xs text-gray-600 leading-relaxed">
            <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-rose-500 bg-white shrink-0" />
                빈 슬롯·미배정
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-100 ring-2 ring-rose-400 shrink-0" />
                대기 접수
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-md bg-slate-200 shrink-0" />
                마감
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-900 shrink-0" />
                선택한 날
              </span>
            </div>
            <p className="mt-2 text-fluid-2xs text-gray-500 border-t border-gray-200/80 pt-2">
              오전·오후 숫자는 남은 청소 가능 자리(휴무 반영)입니다. 사이는 발주서 옵션 접수 건수이며, 확정 시 오전/오후 중 하나를 사용합니다.
            </p>
          </div>

          {/* 달력 그리드 — gap-px로 격자선 정리 */}
          <div className="rounded-xl border border-gray-200 bg-gray-200/90 p-px shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 gap-px bg-gray-200/90 text-left [word-break:keep-all]">
              {WEEKDAYS.map((w, wi) => (
                <div
                  key={w}
                  className={`py-1.5 px-1 sm:py-2.5 sm:px-2.5 text-center text-calendar-xs font-semibold tracking-tight sm:tracking-wide bg-gray-100 min-w-0 ${
                    wi === 0 ? 'text-rose-600' : wi === 6 ? 'text-slate-600' : 'text-gray-600'
                  }`}
                >
                  {w}
                </div>
              ))}
              {calendarDays.map((d, i) => {
                if (d === null) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="min-h-[clamp(5.25rem,2.75rem+14vmin,8rem)] min-w-0 bg-gray-50/90"
                    />
                  );
                }
                const key = getDateKey(d);
                const dayItems = byDate[key] || [];
                const pendingDayCount = dayItems.filter((it) => it.status === 'PENDING').length;
                const dayStats = stats[key];
                const morningRem = dayStats?.assignableMorning ?? 0;
                const afternoonRem = dayStats?.assignableAfternoonSlot ?? 0;
                const sideOrderCount = dayStats?.sideCleaningOrderCount ?? 0;
                const sideUnconfirmed = dayStats?.sideCleaningUnconfirmedCount ?? 0;
                const workingCount = dayStats?.workingCount ?? 0;
                const unassignedCount = dayItems.filter((it) => !it.assignments?.[0]).length;
                const hasEvents = dayItems.length > 0;
                const isSelected = selectedDate === key;
                const isSaturday = i % 7 === 6;
                const isSunday = i % 7 === 0;
                const isHoliday = isPublicHoliday(year, month, d);
                const today = isTodayYmd(year, month, d);
                const hasEmptySlots =
                  workingCount > 0 &&
                  (unassignedCount > 0 ||
                    morningRem > 0 ||
                    afternoonRem > 0 ||
                    sideUnconfirmed > 0);
                const isSlotFull = workingCount > 0 && morningRem === 0 && afternoonRem === 0;
                const weekdayColor =
                  isHoliday || isSunday ? 'text-rose-600' : isSaturday ? 'text-slate-600' : 'text-gray-500';
                const pendingAccent = pendingDayCount > 0 && !isSelected;
                const emptyAccent = !isSelected && hasEmptySlots && pendingDayCount === 0;
                const cellBg = isSelected
                  ? 'bg-white ring-2 ring-gray-900 ring-inset z-[1]'
                  : isSlotFull
                    ? 'bg-slate-100'
                    : hasEvents
                      ? 'bg-slate-50/90'
                      : 'bg-white';
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSelectedDate(isSelected ? null : key);
                      }
                    }}
                    className={`min-h-[clamp(5.25rem,2.75rem+14vmin,8rem)] min-w-0 px-1.5 py-1 sm:px-2 sm:py-1.5 pb-[clamp(1.35rem,3.8vmin,1.85rem)] cursor-pointer relative overflow-visible text-left transition-colors ${
                      cellBg
                    } ${pendingAccent ? 'ring-1 ring-rose-400/90 ring-inset' : ''} ${
                      emptyAccent ? 'ring-1 ring-rose-300/80 ring-inset' : ''
                    } ${!isSelected && !isSlotFull && !pendingAccent ? 'hover:bg-gray-50/95' : ''} ${
                      pendingDayCount > 0 ? 'bg-rose-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-0.5 sm:gap-1 min-w-0">
                      <div className="flex items-center gap-1 min-w-0 sm:gap-1.5">
                        <span
                          className={
                            today
                              ? 'inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-gray-900 text-calendar-xs font-bold text-white shadow-sm tabular-nums sm:h-7 sm:min-w-[1.75rem]'
                              : `text-calendar-xs font-semibold tabular-nums text-gray-900`
                          }
                        >
                          {d}
                        </span>
                        <span className={`text-calendar-2xs font-medium leading-tight ${weekdayColor}`}>
                          {weekdayKoFromYmd(year, month, d)}
                        </span>
                      </div>
                      {pendingDayCount > 0 && (
                        <span
                          className="shrink-0 text-calendar-2xs font-semibold text-rose-800 bg-rose-100/90 px-1 sm:px-1.5 py-0.5 rounded-md leading-none max-w-[min(100%,3.8rem)] truncate"
                          title="대기 접수(발주서 미제출)"
                        >
                          대기{pendingDayCount > 1 ? pendingDayCount : ''}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 sm:mt-2 flex flex-col gap-0.5 sm:gap-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-0.5 sm:gap-1 leading-none whitespace-nowrap min-w-0">
                        <span className={isSlotFull ? 'text-slate-600 font-medium text-calendar-2xs' : 'text-amber-900/90 font-medium text-calendar-2xs'}>
                          오전
                        </span>
                        <span
                          className={`tabular-nums text-calendar-2xs font-semibold shrink-0 ${
                            isSlotFull ? 'text-slate-800' : 'text-amber-950'
                          }`}
                        >
                          {morningRem}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline gap-0.5 sm:gap-1 leading-none whitespace-nowrap min-w-0">
                        <span className={isSlotFull ? 'text-slate-600 font-medium text-calendar-2xs' : 'text-sky-800 font-medium text-calendar-2xs'}>
                          오후
                        </span>
                        <span
                          className={`tabular-nums text-calendar-2xs font-semibold shrink-0 ${
                            isSlotFull ? 'text-slate-800' : 'text-sky-950'
                          }`}
                        >
                          {afternoonRem}
                        </span>
                      </div>
                      <div
                        className={`flex flex-col gap-0.5 border-t pt-1 mt-0.5 ${
                          isSlotFull ? 'border-slate-200' : 'border-gray-200/90'
                        }`}
                      >
                        <div className="flex justify-between items-baseline gap-0.5 sm:gap-1 leading-none whitespace-nowrap min-w-0">
                          <span
                            className={
                              isSlotFull
                                ? 'text-slate-600 font-semibold text-calendar-2xs'
                                : unassignedCount > 0
                                  ? 'text-rose-700 font-semibold text-calendar-2xs'
                                  : 'text-gray-500 text-calendar-2xs'
                            }
                          >
                            미배정
                          </span>
                          <span
                            className={`tabular-nums text-calendar-2xs font-semibold shrink-0 ${
                              isSlotFull
                                ? unassignedCount > 0
                                  ? 'text-slate-900'
                                  : 'text-slate-700'
                                : unassignedCount > 0
                                  ? 'text-rose-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {unassignedCount}
                          </span>
                        </div>
                        {sideOrderCount > 0 && (
                          <div className="flex justify-between items-baseline gap-0.5 sm:gap-1 leading-none whitespace-nowrap min-w-0">
                            <span className={isSlotFull ? 'text-slate-600 font-medium text-calendar-2xs' : 'text-violet-800 font-medium text-calendar-2xs'}>
                              사이
                            </span>
                            <span
                              className={`tabular-nums text-calendar-2xs font-semibold shrink-0 ${
                                isSlotFull ? 'text-slate-900' : 'text-violet-950'
                              }`}
                            >
                              {sideOrderCount}건
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isSlotFull && (
                      <span className="absolute bottom-0.5 left-1 right-1 text-center text-calendar-2xs font-semibold text-slate-600 tracking-wide whitespace-nowrap">
                        마감
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택한 날짜의 일정 목록 + 상세 보기 */}
          {selectedDate && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-fluid-sm font-medium text-gray-800 tabular-nums min-w-0">
                  {formatDateCompactWithWeekday(selectedDate)}{' '}
                  <span className="text-gray-600 font-normal">({(byDate[selectedDate]?.length ?? 0)}건)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateInquiryModalDate(selectedDate)}
                  className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                  title="이 날짜로 신규 접수 (상세와 동일한 폼)"
                  aria-label="이 날짜로 신규 접수"
                >
                  <CirclePlusIcon className="w-5 h-5" />
                </button>
              </div>

              {/* 휴무/근무 현황 */}
              {stats[selectedDate] && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-fluid-sm space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-gray-500">휴무</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].offCount}인</span>
                      {stats[selectedDate].offNames.length > 0 && (
                        <span className="ml-1 text-gray-600">
                          ({stats[selectedDate].offNames.join(', ')})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">근무가능</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].workingCount}명</span>
                    </div>
                    <div>
                      <span className="text-gray-500">오전 소진</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].morningOccupied ?? 0}건</span>
                    </div>
                    <div>
                      <span className="text-gray-500">오후 소진</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].afternoonOccupied ?? 0}건</span>
                    </div>
                  </div>
                  {(stats[selectedDate].sideCleaningOrderCount ?? 0) > 0 && (
                    <div className="text-fluid-sm">
                      <span className="text-gray-500">사이청소 접수</span>
                      <span className="ml-1 font-medium text-violet-800">
                        {stats[selectedDate].sideCleaningOrderCount}건
                      </span>
                      {(stats[selectedDate].sideCleaningUnconfirmedCount ?? 0) > 0 && (
                        <span className="ml-2 text-amber-800">
                          (일정 미확정 {stats[selectedDate].sideCleaningUnconfirmedCount}건)
                        </span>
                      )}
                    </div>
                  )}
                  {(() => {
                    const s = stats[selectedDate];
                    const am = s.assignableMorning ?? 0;
                    const aa = s.assignableAfternoonSlot ?? 0;
                    const sum = s.unassignedTotal ?? am + aa;
                    return (
                      <div className="pt-2 border-t border-gray-200 text-fluid-sm">
                        <span className="text-gray-500">슬롯 남은 자리(건)</span>
                        <span className="ml-2 font-semibold text-blue-800">
                          오전 {am} · 오후 {aa} · 합(TO) {sum}
                        </span>
                        <span className="block text-fluid-xs text-gray-500 mt-1">
                          휴무 팀장은 근무 인원에서 제외됩니다. 사이청소는 확정 시 오전 또는 오후 중 하나를 사용합니다.
                        </span>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-gray-500">오전 배정 가능: </span>
                      <span className="text-blue-600 font-medium">
                        {(stats[selectedDate].availableMorningNames ?? []).length > 0
                          ? (stats[selectedDate].availableMorningNames ?? []).join(', ')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">오후 배정 가능: </span>
                      <span className="text-blue-600 font-medium">
                        {(stats[selectedDate].availableAfternoonNames ?? []).length > 0
                          ? (stats[selectedDate].availableAfternoonNames ?? []).join(', ')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(() => {
                const dayList = byDate[selectedDate] ?? [];
                const morningList = dayList.filter((i) => getScheduleTimeBucket(i) === 'morning');
                const afternoonList = dayList.filter((i) => getScheduleTimeBucket(i) === 'afternoon');
                const otherList = dayList.filter((i) => getScheduleTimeBucket(i) === 'other');
                return (
                  <div className="flex flex-col gap-3">
                    {morningList.length > 0 && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2 border-b-2 border-amber-400 pb-1.5">
                          <span className="text-fluid-sm font-bold text-amber-900">오전 일정</span>
                          <span className="text-fluid-xs text-amber-800/80 tabular-nums">{morningList.length}건</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {morningList.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              onPick={() => setDetailItem(item)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {afternoonList.length > 0 && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2 border-b-2 border-sky-600 pb-1.5">
                          <span className="text-fluid-sm font-bold text-sky-900">오후 일정</span>
                          <span className="text-fluid-xs text-sky-800/80 tabular-nums">{afternoonList.length}건</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {afternoonList.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              onPick={() => setDetailItem(item)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {otherList.length > 0 && (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2 border-b-2 border-violet-400 pb-1.5">
                          <span className="text-fluid-sm font-bold text-violet-900">기타 · 일정 미확정</span>
                          <span className="text-fluid-xs text-violet-800/80 tabular-nums">{otherList.length}건</span>
                        </div>
                        <p className="text-fluid-xs text-gray-600 mb-2">
                          사이청소만 선택·오전·오후 미확정이거나 시간대가 비어 있는 접수입니다.
                        </p>
                        <div className="flex flex-col gap-1">
                          {otherList.map((item) => (
                            <ScheduleDayListItem
                              key={item.id}
                              item={item}
                              profCatalog={profCatalog}
                              onPick={() => setDetailItem(item)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {(byDate[selectedDate]?.length ?? 0) === 0 && (
                <div className="text-center text-gray-500 py-6 text-fluid-sm">
                  해당 날짜에 일정이 없습니다.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {detailItem && token && (
        <ScheduleInquiryDetailModal
          token={token}
          item={detailItem}
          teamLeaders={teamLeaders}
          professionalCatalog={profCatalog}
          scheduleStatsByDate={stats}
          onClose={() => setDetailItem(null)}
          onSaved={() => fetchMonthData(false)}
        />
      )}

      {createInquiryModalDate && token && (
        <ScheduleInquiryDetailModal
          mode="create"
          token={token}
          initialPreferredDate={createInquiryModalDate}
          teamLeaders={teamLeaders}
          professionalCatalog={profCatalog}
          scheduleStatsByDate={stats}
          onClose={() => setCreateInquiryModalDate(null)}
          onSaved={() => {
            setCreateInquiryModalDate(null);
            fetchMonthData(false);
          }}
        />
      )}
    </div>
  );
}
