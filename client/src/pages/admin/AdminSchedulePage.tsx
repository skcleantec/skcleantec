import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSchedule,
  postScheduleDayClosure,
  deleteScheduleDayClosure,
  type ScheduleItem,
} from '../../api/schedule';
import { ScheduleDayAvailabilityModal } from '../../components/admin/ScheduleDayAvailabilityModal';
import { getMe } from '../../api/auth';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import { getTeamLeaders, type UserItem } from '../../api/users';
import { getAllProfessionalOptions, type ProfessionalSpecialtyOptionDto } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import { isPublicHoliday } from '../../utils/holidays';
import { ScheduleInquiryDetailModal } from '../../components/admin/ScheduleInquiryDetailModal';
import { ScheduleInquiryMemoModal } from '../../components/admin/ScheduleInquiryMemoModal';
import { ProfessionalOptionDots } from '../../components/admin/ProfessionalOptionDots';
import {
  formatDateCompactWithWeekday,
  formatPreferredDateInputYmd,
  weekdayKoFromYmd,
} from '../../utils/dateFormat';
import { getScheduleTimeBucket } from '../../utils/scheduleTimeBucket';
import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../../constants/crewCapacity';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function groupScheduleItemsByKstDate(items: ScheduleItem[]) {
  return items.reduce<Record<string, ScheduleItem[]>>((acc, item) => {
    const key = item.preferredDate
      ? formatPreferredDateInputYmd(item.preferredDate) || 'no-date'
      : 'no-date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/** 데이터 로드 직후: 달력에서 우측 목록이 비지 않도록 기본 선택 */
function pickDefaultSelectedDate(
  year: number,
  month: number,
  byDate: Record<string, ScheduleItem[]>
): string | null {
  const keys = Object.keys(byDate).filter((k) => k !== 'no-date').sort();
  if (keys.length === 0) return null;
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    const todayKey = `${year}-${m}-${d}`;
    if ((byDate[todayKey]?.length ?? 0) > 0) return todayKey;
  }
  return keys[0] ?? null;
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
  onOpenMemo,
}: {
  item: ScheduleItem;
  profCatalog: ProfessionalSpecialtyOptionDto[];
  onPick: () => void;
  onOpenMemo: () => void;
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
  const leaderCrewLine = (() => {
    const names = item.assignments.map((a) => a.teamLeader.name).join('·');
    const parts: string[] = [];
    parts.push(names || '미배정');
    const crewN = item.crewMemberCount ?? DEFAULT_CREW_UNITS_PER_INQUIRY;
    parts.push(`팀원${crewN}명`);
    if (item.crewMemberNote?.trim()) parts.push(item.crewMemberNote.trim());
    return parts.join(' · ');
  })();
  const timeTeamLine = `${slotLabelShort} · ${leaderCrewLine}`;
  const scheduleMemoLine = item.scheduleMemo?.trim() ?? '';
  const hasScheduleMemo = Boolean(scheduleMemoLine);

  return (
    <div
      className={`text-left w-full py-1.5 pl-2 pr-1 rounded-md flex gap-1.5 border border-gray-200/90 shadow-sm text-fluid-sm ${slotAccent} ${
        isPending ? 'ring-1 ring-red-500' : ''
      }`}
    >
      <span
        className={`shrink-0 self-center inline-flex items-center justify-center min-w-[2.25rem] px-1 py-0.5 text-fluid-2xs font-bold leading-none rounded ${slotBadgeClass}`}
      >
        {slotLabelShort}
      </span>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={onPick}
            className="min-w-0 flex-1 text-left font-medium text-gray-900 inline-flex items-center gap-1.5 flex-wrap"
          >
            <span className="truncate min-w-0">{item.customerName}</span>
            {(item.inquiryNumber || hasScheduleMemo) && (
              <span className="inline-flex items-center gap-0.5 flex-nowrap shrink-0 text-[10px] sm:text-fluid-2xs font-normal">
                {item.inquiryNumber ? (
                  <span className="text-gray-400 tabular-nums leading-none shrink-0">{item.inquiryNumber}</span>
                ) : null}
                {hasScheduleMemo ? (
                  <span
                    className="text-[9px] sm:text-[10px] leading-none font-medium text-gray-800 bg-white/80 border border-gray-200/90 rounded px-1 py-px max-w-[min(10rem,38vw)] truncate shadow-sm"
                    title={scheduleMemoLine}
                  >
                    {scheduleMemoLine}
                  </span>
                ) : null}
              </span>
            )}
            <span className="shrink-0 inline-flex">
              <ProfessionalOptionDots rawIds={item.professionalOptionIds} catalog={profCatalog} />
            </span>
          </button>
          {isPending && (
            <span className="text-fluid-2xs font-semibold text-red-700 shrink-0">대기</span>
          )}
          <button
            type="button"
            onClick={onOpenMemo}
            className={`shrink-0 px-1.5 py-0.5 text-[10px] sm:text-fluid-2xs font-medium rounded border tabular-nums ${
              hasScheduleMemo
                ? 'border-blue-400 bg-blue-50 text-blue-900 hover:bg-blue-100'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            title="메모"
          >
            메모
          </button>
        </div>
        <button
          type="button"
          onClick={onPick}
          className="text-left w-full text-fluid-xs text-gray-600 leading-snug truncate hover:brightness-[0.99]"
        >
          {shortSiGuFromAddress(item.address)}
          {item.areaPyeong != null && item.areaPyeong > 0
            ? ` / ${formatPyeongDisplay(item.areaPyeong)}`
            : ''}
          <span className="text-gray-400"> · </span>
          {timeTeamLine}
        </button>
      </div>
    </div>
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

function isFullDayClosure(s: ScheduleStatsByDate | undefined): boolean {
  if (!s) return false;
  if (s.closureScope === 'FULL') return true;
  if (s.closureScope === 'MORNING' || s.closureScope === 'AFTERNOON') return false;
  return Boolean(s.manualClosed);
}

function hasScheduleClosure(s: ScheduleStatsByDate | undefined): boolean {
  return Boolean(s?.closureScope) || Boolean(s?.manualClosed);
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
  const [memoModalItem, setMemoModalItem] = useState<ScheduleItem | null>(null);
  /** 신규 접수 모달 — 선택한 캘린더 날짜로 예약일 고정 */
  const [createInquiryModalDate, setCreateInquiryModalDate] = useState<string | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [profCatalog, setProfCatalog] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [closureBusy, setClosureBusy] = useState(false);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const fetchGenRef = useRef(0);

  const fetchMonthData = useCallback(
    async (showLoading: boolean) => {
      if (!token) {
        if (showLoading) setLoading(false);
        return;
      }
      const rid = ++fetchGenRef.current;
      if (showLoading) setLoading(true);
      const { start, end } = getMonthRange(year, month);
      setLoadError(null);

      let scheduleErr: string | null = null;
      let statsErr: string | null = null;

      try {
        const scheduleRes = await getSchedule(token, start, end);
        if (rid !== fetchGenRef.current) return;
        setItems(scheduleRes.items);
        const grouped = groupScheduleItemsByKstDate(scheduleRes.items);
        setSelectedDate((prev) => {
          if (prev != null) return prev;
          return pickDefaultSelectedDate(year, month, grouped);
        });
      } catch (e) {
        if (rid !== fetchGenRef.current) return;
        setItems([]);
        scheduleErr = e instanceof Error ? e.message : '스케줄을 불러오지 못했습니다.';
      }

      try {
        const statsRes = await getScheduleStats(token, start, end);
        if (rid !== fetchGenRef.current) return;
        setStats(statsRes.byDate);
      } catch {
        if (rid !== fetchGenRef.current) return;
        setStats({});
        statsErr = '스케줄 현황(통계)을 불러오지 못했습니다. 접수 목록은 표시됩니다.';
      }

      if (rid !== fetchGenRef.current) return;
      if (scheduleErr && statsErr) setLoadError(`${scheduleErr} ${statsErr}`);
      else if (scheduleErr) setLoadError(scheduleErr);
      else if (statsErr) setLoadError(statsErr);
      else setLoadError(null);

      if (showLoading) setLoading(false);
    },
    [token, year, month]
  );

  const submitClosure = useCallback(
    async (scope: 'FULL' | 'MORNING' | 'AFTERNOON') => {
      if (!token || !selectedDate) return;
      setClosureBusy(true);
      try {
        await postScheduleDayClosure(token, selectedDate, scope);
        setClosureModalOpen(false);
        await fetchMonthData(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : '일정 마감 처리에 실패했습니다.');
      } finally {
        setClosureBusy(false);
      }
    },
    [token, selectedDate, fetchMonthData]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMonthData(true);
    });
  }, [fetchMonthData]);

  const prevYearMonthRef = useRef<{ y: number; m: number } | null>(null);
  useEffect(() => {
    const prev = prevYearMonthRef.current;
    if (prev != null && (prev.y !== year || prev.m !== month)) {
      setSelectedDate(null);
    }
    prevYearMonthRef.current = { y: year, m: month };
  }, [year, month]);

  useEffect(() => {
    if (!token) return;
    getTeamLeaders(token).then(setTeamLeaders).catch(() => setTeamLeaders([]));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setMeRole(null);
      return;
    }
    getMe(token)
      .then((u: { role?: string }) => setMeRole(typeof u.role === 'string' ? u.role : null))
      .catch(() => setMeRole(null));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getAllProfessionalOptions(token)
      .then(setProfCatalog)
      .catch(() => setProfCatalog([]));
  }, [token]);

  const byDate = groupScheduleItemsByKstDate(items);

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
              오전·오후는 팀장 슬롯 잔여(휴무 반영)입니다. 팀원은 그날 휴무를 제외한 가용 인원 기준 잔여(명)입니다.
              표준 접수는 팀원 {DEFAULT_CREW_UNITS_PER_INQUIRY}명 단위로 집계합니다. 사이는 발주서 옵션 건수이며 확정 시
              오전 또는 오후 한 칸을 씁니다.
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
                const isSlotFull =
                  Boolean(dayStats && isFullDayClosure(dayStats)) ||
                  (workingCount > 0 && morningRem === 0 && afternoonRem === 0);
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
                      {dayStats &&
                        (dayStats.crewRemaining != null || dayStats.additionalStandardJobsByCrew != null) && (
                          <div className="flex justify-between items-baseline gap-0.5 sm:gap-1 leading-none whitespace-nowrap min-w-0 pt-0.5 border-t border-gray-200/80 mt-0.5">
                            <span
                              className={
                                isSlotFull
                                  ? 'text-slate-600 font-medium text-calendar-2xs'
                                  : 'text-emerald-900 font-medium text-calendar-2xs'
                              }
                              title="휴무 반영 활성 팀원 기준 잔여(명). 표준 접수는 팀원 2명 단위로 집계합니다."
                            >
                              팀원
                            </span>
                            <span
                              className={`tabular-nums text-calendar-2xs font-semibold shrink-0 ${
                                isSlotFull ? 'text-slate-800' : 'text-emerald-950'
                              }`}
                              title={`휴무 ${dayStats.crewDayOffCount ?? 0}명 · 잔여 ${dayStats.crewRemaining ?? 0}명 · 표준(2명) 접수 약 ${dayStats.additionalStandardJobsByCrew ?? 0}건 가능`}
                            >
                              {dayStats.crewRemaining ?? 0}
                            </span>
                          </div>
                        )}
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
                <div className="flex items-center gap-2 shrink-0">
                  {meRole === 'ADMIN' && token && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAvailabilityModalOpen(true)}
                        className="px-3 py-1.5 text-fluid-xs font-medium rounded-md border border-blue-200 bg-white text-blue-900 hover:bg-blue-50"
                      >
                        가용인원
                      </button>
                      {hasScheduleClosure(stats[selectedDate]) ? (
                        <button
                          type="button"
                          disabled={closureBusy}
                          onClick={async () => {
                            setClosureBusy(true);
                            try {
                              await deleteScheduleDayClosure(token, selectedDate);
                              await fetchMonthData(false);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : '일정 마감 해제에 실패했습니다.');
                            } finally {
                              setClosureBusy(false);
                            }
                          }}
                          className="px-3 py-1.5 text-fluid-xs font-medium rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        >
                          일정마감 해제
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={closureBusy}
                          onClick={() => setClosureModalOpen(true)}
                          className="px-3 py-1.5 text-fluid-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50"
                        >
                          일정마감
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setCreateInquiryModalDate(selectedDate)}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                    title="이 날짜로 신규 접수 (상세와 동일한 폼)"
                    aria-label="이 날짜로 신규 접수"
                  >
                    <CirclePlusIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {stats[selectedDate]?.closureScope === 'FULL' ||
              (stats[selectedDate]?.manualClosed && !stats[selectedDate]?.closureScope) ? (
                <p className="mb-3 text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  이 날짜는 관리자 일정마감(전체)이 적용되어 잔여 슬롯(TO)과 팀원 가용이 없는 상태로 표시됩니다.
                </p>
              ) : null}
              {stats[selectedDate]?.closureScope === 'MORNING' ? (
                <p className="mb-3 text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  이 날짜는 <strong className="font-medium">오전</strong> 일정만 마감되어 오전 잔여(TO)가 0으로 표시됩니다.
                </p>
              ) : null}
              {stats[selectedDate]?.closureScope === 'AFTERNOON' ? (
                <p className="mb-3 text-fluid-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  이 날짜는 <strong className="font-medium">오후</strong> 일정만 마감되어 오후 잔여(TO)가 0으로 표시됩니다.
                </p>
              ) : null}

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
                  {stats[selectedDate]?.crewRemaining != null && (
                    <div className="pt-2 border-t border-gray-200 text-fluid-sm">
                      <span className="text-gray-500">팀원 투입</span>
                      <span className="ml-2 font-semibold text-emerald-900">
                        휴무 {stats[selectedDate].crewDayOffCount ?? 0}명 · 가용 {stats[selectedDate].crewAvailable ?? 0}명
                        · 소진 {stats[selectedDate].crewDemand ?? 0}단위 · 잔여 {stats[selectedDate].crewRemaining}명
                      </span>
                      <span className="block text-fluid-xs text-gray-500 mt-1">
                        미입력 접수는 표준 {DEFAULT_CREW_UNITS_PER_INQUIRY}명(팀장1+팀원2의 반일 1건)으로 집계합니다. 잔여
                        기준 표준 접수 추가 가능 약 {stats[selectedDate].additionalStandardJobsByCrew ?? 0}건(참고).
                      </span>
                    </div>
                  )}
                  <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
                    <div>
                      <div className="text-[11px] sm:text-xs text-gray-500">
                        오전 근무 가능{' '}
                        <span className="tabular-nums">
                          ({stats[selectedDate].morningWorkingCount ?? (stats[selectedDate].morningWorkingNames ?? []).length}명)
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] sm:text-xs text-gray-800 font-normal leading-snug break-words">
                        {(stats[selectedDate].morningWorkingNames ?? []).length > 0
                          ? (stats[selectedDate].morningWorkingNames ?? []).join(', ')
                          : '—'}
                      </p>
                      <div className="mt-1.5 text-[11px] sm:text-xs text-gray-500">
                        오전 추가 배정 가능{' '}
                        <span className="tabular-nums">
                          ({(stats[selectedDate].availableMorningNames ?? []).length}명)
                        </span>
                        <span className="text-gray-400"> · 이미 오전 일정에 배정된 팀장은 제외</span>
                      </div>
                      <p className="mt-0.5 text-[11px] sm:text-xs text-blue-700 font-normal leading-snug break-words">
                        {(stats[selectedDate].availableMorningNames ?? []).length > 0
                          ? (stats[selectedDate].availableMorningNames ?? []).join(', ')
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <div className="text-[11px] sm:text-xs text-gray-500">
                        오후 근무 가능{' '}
                        <span className="tabular-nums">
                          ({stats[selectedDate].afternoonWorkingCount ?? (stats[selectedDate].afternoonWorkingNames ?? []).length}명)
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] sm:text-xs text-gray-800 font-normal leading-snug break-words">
                        {(stats[selectedDate].afternoonWorkingNames ?? []).length > 0
                          ? (stats[selectedDate].afternoonWorkingNames ?? []).join(', ')
                          : '—'}
                      </p>
                      <div className="mt-1.5 text-[11px] sm:text-xs text-gray-500">
                        오후 추가 배정 가능{' '}
                        <span className="tabular-nums">
                          ({(stats[selectedDate].availableAfternoonNames ?? []).length}명)
                        </span>
                        <span className="text-gray-400"> · 이미 오후 일정에 배정된 팀장은 제외</span>
                      </div>
                      <p className="mt-0.5 text-[11px] sm:text-xs text-blue-700 font-normal leading-snug break-words">
                        {(stats[selectedDate].availableAfternoonNames ?? []).length > 0
                          ? (stats[selectedDate].availableAfternoonNames ?? []).join(', ')
                          : '—'}
                      </p>
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
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
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
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
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
                              onPick={() => {
                                setMemoModalItem(null);
                                setDetailItem(item);
                              }}
                              onOpenMemo={() => {
                                setDetailItem(null);
                                setMemoModalItem(item);
                              }}
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

      {memoModalItem && token && (
        <ScheduleInquiryMemoModal
          token={token}
          item={memoModalItem}
          onClose={() => setMemoModalItem(null)}
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

      {closureModalOpen && selectedDate && token && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal
          aria-labelledby="closure-scope-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="닫기"
            onClick={() => setClosureModalOpen(false)}
          />
          <div
            className="relative bg-white rounded-xl shadow-xl border border-gray-200 p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="closure-scope-title" className="text-base font-semibold text-gray-900 mb-1">
              일정 마감 범위
            </h3>
            <p className="text-fluid-xs text-gray-600 mb-4">
              선택한 구간의 잔여 TO가 0으로 표시됩니다. 전체 마감 시 팀원 가용도 0으로 표시됩니다.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => void submitClosure('FULL')}
                className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                전체 (오전·오후)
              </button>
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => void submitClosure('MORNING')}
                className="w-full py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-950 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
              >
                오전만
              </button>
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => void submitClosure('AFTERNOON')}
                className="w-full py-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-950 text-sm font-medium hover:bg-sky-100 disabled:opacity-50"
              >
                오후만
              </button>
              <button
                type="button"
                disabled={closureBusy}
                onClick={() => setClosureModalOpen(false)}
                className="w-full py-2 rounded-lg border border-gray-200 text-gray-700 text-sm hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {availabilityModalOpen && selectedDate && token && (
        <ScheduleDayAvailabilityModal
          open={availabilityModalOpen}
          date={selectedDate}
          token={token}
          onClose={() => setAvailabilityModalOpen(false)}
          onSaved={() => void fetchMonthData(false)}
        />
      )}
    </div>
  );
}
