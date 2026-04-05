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
      className={`text-left w-full py-1.5 px-2 rounded-md flex gap-1.5 border border-gray-200/90 shadow-sm ${slotAccent} ${
        isPending ? 'ring-1 ring-red-500' : ''
      } hover:brightness-[0.99]`}
    >
      <span
        className={`shrink-0 self-center inline-flex items-center justify-center min-w-[2.25rem] px-1 py-0.5 text-[10px] font-bold leading-none rounded ${slotBadgeClass}`}
      >
        {slotLabelShort}
      </span>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="font-medium text-sm text-gray-900 truncate inline-flex items-center gap-1 min-w-0">
            {item.customerName}
            <ProfessionalOptionDots rawIds={item.professionalOptionIds} catalog={profCatalog} />
          </span>
          {isPending && (
            <span className="text-[10px] font-semibold text-red-700 shrink-0">대기</span>
          )}
        </div>
        <p className="text-[11px] text-gray-600 leading-snug truncate">
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

  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h1 className="text-xl font-semibold text-gray-800">스케줄 표</h1>

      <div className="flex gap-2 items-center">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{loadError}</div>
      )}
      {loading ? (
        <div className="py-12 text-center text-gray-500 text-sm">로딩 중...</div>
      ) : (
        <>
          {/* 범례 */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-red-500 rounded shrink-0" />
              빈 슬롯/미배정 (빨간 테두리)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-red-500 rounded shrink-0 bg-red-50/80" />
              대기 접수 (발주서 미제출, 동일 빨간 테두리)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded shrink-0 bg-blue-400" />
              마감 (오전·오후 남은 자리 없음, 파란 음영)
            </span>
            <span className="text-gray-500">
              오전·오후 숫자는 남은 청소 가능 자리(휴무 반영). 사이는 발주서 옵션 접수 건수만 표시하며, 확정 시 오전/오후 중 하나를 소모합니다.
            </span>
          </div>

          {/* 달력 그리드 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 text-left text-xs">
              {WEEKDAYS.map((w, wi) => (
                <div
                  key={w}
                  className={`py-1.5 px-1 font-medium border-b border-r border-gray-200 last:border-r-0 text-[10px] ${
                    wi === 6 ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  {w}
                </div>
              ))}
              {calendarDays.map((d, i) => {
                if (d === null) {
                  return <div key={`empty-${i}`} className="min-h-[120px] bg-gray-50" />;
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
                const isHoliday = isPublicHoliday(year, month, d);
                const hasEmptySlots =
                  workingCount > 0 &&
                  (unassignedCount > 0 ||
                    morningRem > 0 ||
                    afternoonRem > 0 ||
                    sideUnconfirmed > 0);
                const isSlotFull = workingCount > 0 && morningRem === 0 && afternoonRem === 0;
                const dateColor = isSlotFull
                  ? 'text-blue-800'
                  : isHoliday
                    ? 'text-red-600'
                    : isSaturday
                      ? 'text-blue-600'
                      : hasEvents
                        ? 'text-blue-700'
                        : 'text-gray-800';
                const pendingRing =
                  pendingDayCount > 0 && !isSelected
                    ? 'ring-2 ring-red-500 ring-inset z-[1]'
                    : '';
                const emptySlotRing =
                  !isSelected && hasEmptySlots && pendingDayCount === 0 ? 'ring-2 ring-red-500 ring-inset' : '';
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    className={`min-h-[120px] p-1 pt-3.5 pb-6 border-b border-r border-gray-200 last:border-r-0 cursor-pointer relative overflow-hidden text-left ${
                      isSlotFull
                        ? 'bg-gradient-to-br from-blue-100 via-sky-50 to-blue-200'
                        : hasEvents
                          ? 'bg-blue-50'
                          : ''
                    } ${isSelected ? 'ring-4 ring-green-600 ring-inset z-[1]' : ''} ${pendingRing || emptySlotRing} ${
                      !isSlotFull && !hasEvents ? 'hover:bg-gray-50' : ''
                    } ${pendingDayCount > 0 ? 'bg-red-50/40' : ''}`}
                  >
                    <span className={`absolute top-0.5 left-1 text-[9px] font-semibold leading-tight tabular-nums ${dateColor}`}>
                      {d} {weekdayKoFromYmd(year, month, d)}
                    </span>
                    {pendingDayCount > 0 && (
                      <span
                        className="absolute top-0.5 right-0.5 text-[9px] font-bold text-red-700 bg-red-100 px-0.5 rounded leading-tight"
                        title="대기 접수(발주서 미제출)"
                      >
                        대기{pendingDayCount > 1 ? pendingDayCount : ''}
                      </span>
                    )}
                    <div className="mt-3.5 flex flex-col gap-0.5 pr-0.5">
                      <div className="flex justify-between items-baseline gap-1 leading-none">
                        <span
                          className={
                            isSlotFull ? 'text-blue-800 font-medium' : 'text-amber-900 font-medium'
                          }
                        >
                          오전
                        </span>
                        <span
                          className={`tabular-nums text-[11px] font-bold ${
                            isSlotFull ? 'text-blue-900' : 'text-amber-950'
                          }`}
                        >
                          {morningRem}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline gap-1 leading-none">
                        <span
                          className={
                            isSlotFull ? 'text-blue-800 font-medium' : 'text-sky-800 font-medium'
                          }
                        >
                          오후
                        </span>
                        <span
                          className={`tabular-nums text-[11px] font-bold ${
                            isSlotFull ? 'text-blue-900' : 'text-sky-950'
                          }`}
                        >
                          {afternoonRem}
                        </span>
                      </div>
                      <div
                        className={`flex flex-col gap-0.5 border-t pt-0.5 mt-0.5 ${
                          isSlotFull ? 'border-blue-200/90' : 'border-gray-200/90'
                        }`}
                      >
                        <div className="flex justify-between items-baseline gap-1 leading-none">
                          <span
                            className={
                              isSlotFull
                                ? 'text-blue-800 font-semibold'
                                : unassignedCount > 0
                                  ? 'text-red-700 font-semibold'
                                  : 'text-gray-500'
                            }
                          >
                            미배정
                          </span>
                          <span
                            className={`tabular-nums text-[11px] font-bold ${
                              isSlotFull
                                ? unassignedCount > 0
                                  ? 'text-blue-900'
                                  : 'text-blue-800'
                                : unassignedCount > 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {unassignedCount}
                          </span>
                        </div>
                        {sideOrderCount > 0 && (
                          <div className="flex justify-between items-baseline gap-1 leading-none">
                            <span
                              className={
                                isSlotFull ? 'text-blue-800 font-medium' : 'text-violet-800 font-medium'
                              }
                            >
                              사이
                            </span>
                            <span
                              className={`tabular-nums text-[11px] font-bold ${
                                isSlotFull ? 'text-blue-900' : 'text-violet-950'
                              }`}
                            >
                              {sideOrderCount}건
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isSlotFull && (
                      <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] font-bold text-blue-800 tracking-wide">
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
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-medium text-gray-800 tabular-nums min-w-0">
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
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm space-y-2">
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
                    <div className="text-sm">
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
                      <div className="pt-2 border-t border-gray-200 text-sm">
                        <span className="text-gray-500">슬롯 남은 자리(건)</span>
                        <span className="ml-2 font-semibold text-blue-800">
                          오전 {am} · 오후 {aa} · 합(TO) {sum}
                        </span>
                        <span className="block text-xs text-gray-500 mt-1">
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
                          <span className="text-sm font-bold text-amber-900">오전 일정</span>
                          <span className="text-xs text-amber-800/80 tabular-nums">{morningList.length}건</span>
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
                          <span className="text-sm font-bold text-sky-900">오후 일정</span>
                          <span className="text-xs text-sky-800/80 tabular-nums">{afternoonList.length}건</span>
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
                          <span className="text-sm font-bold text-violet-900">기타 · 일정 미확정</span>
                          <span className="text-xs text-violet-800/80 tabular-nums">{otherList.length}건</span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
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
                <div className="text-center text-gray-500 py-6 text-sm">
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
