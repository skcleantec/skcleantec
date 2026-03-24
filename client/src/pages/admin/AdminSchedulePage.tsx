import { useState, useEffect, useCallback } from 'react';
import { getSchedule, type ScheduleItem } from '../../api/schedule';
import { getScheduleStats, type ScheduleStatsByDate } from '../../api/dayoffs';
import { getTeamLeaders, type UserItem } from '../../api/users';
import { getToken } from '../../stores/auth';
import { isPublicHoliday } from '../../utils/holidays';
import { ScheduleInquiryDetailModal } from '../../components/admin/ScheduleInquiryDetailModal';
import { labelForTimeSlot } from '../../constants/orderFormSchedule';

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

/** 접수 정산 필드 우선, 없으면 발주서 금액 (발주서 상단 블록과 동일한 표기) */
function effectiveScheduleAmounts(item: ScheduleItem) {
  return {
    total: item.serviceTotalAmount ?? item.orderForm?.totalAmount ?? null,
    deposit: item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null,
    balance: item.serviceBalanceAmount ?? item.orderForm?.balanceAmount ?? null,
  };
}

function hasScheduleAmountDisplay(a: ReturnType<typeof effectiveScheduleAmounts>) {
  return a.total != null || a.deposit != null || a.balance != null;
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

export function AdminSchedulePage() {
  const token = getToken();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [stats, setStats] = useState<Record<string, ScheduleStatsByDate>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<ScheduleItem | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);

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
        })
        .catch(() => {
          setItems([]);
          setStats({});
        })
        .finally(() => {
          if (showLoading) setLoading(false);
        });
    },
    [token, year, month]
  );

  useEffect(() => {
    fetchMonthData(true);
  }, [fetchMonthData]);

  useEffect(() => {
    if (!token) return;
    getTeamLeaders(token).then(setTeamLeaders).catch(() => setTeamLeaders([]));
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

      {loading ? (
        <div className="py-12 text-center text-gray-500 text-sm">로딩 중...</div>
      ) : (
        <>
          {/* 범례 */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-red-500 rounded shrink-0" />
              빈 배정 (미배정 또는 오전·오후 슬롯 부족)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded shrink-0 bg-violet-900" />
              마감 (휴무 반영 후 근무 팀장 기준 오전·오후 각 1건씩 배정됨)
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
                  return <div key={`empty-${i}`} className="min-h-[68px] bg-gray-50" />;
                }
                const key = getDateKey(d);
                const dayItems = byDate[key] || [];
                const dayStats = stats[key];
                const morningCount = dayStats?.morningCount ?? 0;
                const afternoonCount = dayStats?.afternoonCount ?? 0;
                const offCount = dayStats?.offCount ?? 0;
                const workingCount = dayStats?.workingCount ?? 0;
                const unassignedCount = dayItems.filter((it) => !it.assignments?.[0]).length;
                const hasEvents = dayItems.length > 0;
                const isSelected = selectedDate === key;
                const isSaturday = i % 7 === 6;
                const isHoliday = isPublicHoliday(year, month, d);
                const hasEmptySlots =
                  workingCount > 0 &&
                  (unassignedCount > 0 || morningCount < workingCount || afternoonCount < workingCount);
                const isSlotFull =
                  workingCount > 0 &&
                  morningCount >= workingCount &&
                  afternoonCount >= workingCount;
                const dateColor = isSlotFull
                  ? 'text-amber-200'
                  : isHoliday
                    ? 'text-red-600'
                    : isSaturday
                      ? 'text-blue-600'
                      : hasEvents
                        ? 'text-blue-700'
                        : 'text-gray-800';
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    className={`min-h-[52px] p-1 pt-3.5 border-b border-r border-gray-200 last:border-r-0 cursor-pointer relative overflow-hidden text-left ${
                      isSlotFull
                        ? 'bg-gradient-to-br from-violet-900 to-indigo-950'
                        : hasEvents
                          ? 'bg-blue-50'
                          : ''
                    } ${isSelected ? 'ring-2 ring-blue-500 ring-inset z-[1]' : ''} ${
                      !isSelected && hasEmptySlots ? 'ring-2 ring-red-500 ring-inset' : ''
                    } ${!isSlotFull && !hasEvents ? 'hover:bg-gray-50' : ''}`}
                  >
                    <span className={`absolute top-0.5 left-1 text-[11px] font-semibold ${dateColor}`}>
                      {d}
                    </span>
                    {isSlotFull && (
                      <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold text-amber-300 tracking-wide">
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
              <h3 className="text-base font-medium text-gray-800 mb-3">
                {new Date(selectedDate).toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}{' '}
                ({(byDate[selectedDate]?.length ?? 0)}건)
              </h3>

              {/* 빈 배정 경고 */}
              {stats[selectedDate] && (() => {
                const s = stats[selectedDate];
                const working = s.workingCount ?? 0;
                const morning = s.morningCount ?? 0;
                const afternoon = s.afternoonCount ?? 0;
                const unassigned = (byDate[selectedDate] ?? []).filter((it) => !it.assignments?.[0]).length;
                const needsAttention =
                  working > 0 && (unassigned > 0 || morning < working || afternoon < working);
                if (!needsAttention) return null;
                return (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    <strong>빈 배정 있음</strong> · 팀장당 오전1·오후1 배정이 되어야 합니다.
                    {unassigned > 0 && ` 미배정 ${unassigned}건`}
                    {(morning < working || afternoon < working) &&
                      ` · 오전 ${morning}/${working}건, 오후 ${afternoon}/${working}건`}
                  </div>
                );
              })()}

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
                      <span className="text-gray-500">오전 DB</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].morningCount}건</span>
                    </div>
                    <div>
                      <span className="text-gray-500">오후 DB</span>
                      <span className="ml-1 font-medium">{stats[selectedDate].afternoonCount}건</span>
                    </div>
                  </div>
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

              <div className="flex flex-col gap-2">
                {(byDate[selectedDate] ?? []).map((item) => {
                  const amt = effectiveScheduleAmounts(item);
                  const showAmt = hasScheduleAmountDisplay(amt);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDetailItem(item)}
                      className="text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 flex flex-col gap-1"
                    >
                      {showAmt && (
                        <div className="mb-1 pb-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">
                            총 금액 {(amt.total ?? 0).toLocaleString()}원
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            잔금 {(amt.balance ?? 0).toLocaleString()}원, 예약금{' '}
                            {(amt.deposit ?? 0).toLocaleString()}원
                          </p>
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{item.customerName}</span>
                      <span className="text-xs text-gray-600 truncate">
                        {item.address}
                        {item.addressDetail ? ` ${item.addressDetail}` : ''}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.preferredTime ? labelForTimeSlot(item.preferredTime) : '-'} ·{' '}
                        {item.assignments[0]?.teamLeader?.name ?? '미배정'}
                      </span>
                    </button>
                  );
                })}
              </div>
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
          onClose={() => setDetailItem(null)}
          onSaved={() => fetchMonthData(false)}
        />
      )}
    </div>
  );
}
