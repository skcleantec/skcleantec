import { useState, useEffect, useCallback } from 'react';
import { completeTeamHappyCall, getTeamHappyCallStats, getTeamInquiries } from '../../api/team';
import { getTeamToken } from '../../stores/teamAuth';
import { isPublicHoliday } from '../../utils/holidays';
import { formatDateCompactWithWeekday, weekdayKoFromYmd } from '../../utils/dateFormat';
import {
  STATUS_LABELS,
  WEEKDAYS,
  type InquiryItem,
  formatScheduleLine,
  formatRoomInfo,
  getCalendarDays,
  TeamHappyCallBadge,
  TeamInquiryDetailModal,
} from './teamInquiryShared';

export function TeamSchedulePage() {
  const token = getTeamToken();
  const now = new Date();
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<InquiryItem | null>(null);
  const [happyStats, setHappyStats] = useState({ overdueCount: 0, pendingBeforeDeadlineCount: 0 });

  const loadSchedule = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [inv, hc] = await Promise.all([
        getTeamInquiries(token) as Promise<{ items: InquiryItem[] }>,
        getTeamHappyCallStats(token).catch(() => ({ overdueCount: 0, pendingBeforeDeadlineCount: 0 })),
      ]);
      setItems(inv.items);
      setHappyStats(hc);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const withDate = items.filter((i) => i.preferredDate && i.status !== 'CANCELLED');
  const byDate = withDate.reduce<Record<string, InquiryItem[]>>((acc, item) => {
    const key = item.preferredDate!.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const calendarDays = getCalendarDays(year, month);
  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 text-fluid-sm">로딩 중...</div>
    );
  }

  return (
    <div className="flex flex-col gap-5 min-w-0 pb-4">
      <h1 className="text-xl font-semibold text-gray-800">스케줄</h1>
      {(happyStats.overdueCount > 0 || happyStats.pendingBeforeDeadlineCount > 0) && (
        <div
          className={`rounded-xl border px-4 py-3 text-fluid-sm ${
            happyStats.overdueCount > 0
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          해피콜 미완:{' '}
          {happyStats.overdueCount > 0 && (
            <>
              마감 초과 <strong className="tabular-nums">{happyStats.overdueCount}</strong>건
            </>
          )}
          {happyStats.overdueCount > 0 && happyStats.pendingBeforeDeadlineCount > 0 && ' · '}
          {happyStats.pendingBeforeDeadlineCount > 0 && (
            <>
              마감 전 <strong className="tabular-nums">{happyStats.pendingBeforeDeadlineCount}</strong>건
            </>
          )}
        </div>
      )}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3 px-1 flex items-center gap-2">
          <span className="w-1 h-4 bg-gray-400 rounded" />
          달력 · 날짜별 상세
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex gap-2 p-3 border-b border-gray-100">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-fluid-sm"
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-fluid-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 text-center text-calendar-xs [word-break:keep-all]">
            {WEEKDAYS.map((w, wi) => (
              <div
                key={w}
                className={`py-1.5 px-1 sm:py-2 sm:px-2 font-medium min-w-0 ${wi === 6 ? 'text-blue-600' : 'text-gray-500'}`}
              >
                {w}
              </div>
            ))}
            {calendarDays.map((d, i) => {
              if (d === null) {
                return (
                  <div
                    key={`e-${i}`}
                    className="min-h-[clamp(2.5rem,1.5rem+8vmin,3.25rem)] min-w-0 bg-gray-50/50"
                  />
                );
              }
              const key = getDateKey(d);
              const dayItems = byDate[key] || [];
              const hasEvents = dayItems.length > 0;
              const isToday = key === todayStr;
              const isSelected = selectedDate === key;
              const isSaturday = i % 7 === 6;
              const isHoliday = isPublicHoliday(year, month, d);
              const dateColor = isHoliday ? 'text-red-600' : isSaturday ? 'text-blue-600' : hasEvents ? 'text-blue-700' : 'text-gray-800';
              return (
                <div
                  key={key}
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={`min-h-[clamp(2.5rem,1.5rem+8vmin,3.25rem)] min-w-0 px-1.5 py-0.5 sm:px-2 sm:py-1 pt-[clamp(1.1rem,2.8vmin,1.35rem)] relative flex flex-col items-center justify-center cursor-pointer touch-manipulation overflow-visible ${
                    hasEvents ? 'bg-blue-50' : ''
                  } ${isToday ? 'ring-1 ring-blue-400 ring-inset' : ''} ${isSelected ? 'bg-blue-200' : 'active:bg-gray-100'}`}
                >
                  <span className={`absolute top-0.5 left-1 right-1 text-center text-calendar-2xs font-medium leading-tight tabular-nums ${dateColor}`}>
                    {d} {weekdayKoFromYmd(year, month, d)}
                  </span>
                  {hasEvents && (
                    <span className="text-calendar-2xs text-blue-600 font-medium">{dayItems.length}건</span>
                  )}
                </div>
              );
            })}
          </div>
          {selectedDate && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <h3 className="text-fluid-xs font-semibold text-gray-700 mb-3 tabular-nums">
                {formatDateCompactWithWeekday(selectedDate)} 상세
              </h3>
              {(byDate[selectedDate]?.length ?? 0) > 0 ? (
                <div className="flex flex-col gap-2">
                  {byDate[selectedDate].map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                      onClick={() => setDetailItem(item)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900">{item.customerName}</div>
                          <div className="text-fluid-sm text-gray-600 mt-0.5">
                            {item.customerPhone}
                          </div>
                          <div className="text-fluid-xs text-gray-500 mt-1 break-words">
                            {item.address}
                            {item.addressDetail ? ` ${item.addressDetail}` : ''}
                          </div>
                          <div className="text-fluid-xs text-gray-500 mt-0.5">
                            {formatScheduleLine(item)} · {formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)} · {item.areaPyeong ?? '-'}평
                          </div>
                        </div>
                        <a
                          href={`tel:${item.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-fluid-xs font-medium"
                        >
                          전화
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-block px-2 py-0.5 rounded text-fluid-xs bg-gray-200 text-gray-800">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                        <TeamHappyCallBadge item={item} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-fluid-sm py-4">
                  해당 날짜에 일정이 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {detailItem && (
        <TeamInquiryDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          enableHappyCall
          onHappyCallComplete={async () => {
            if (!token) return;
            await completeTeamHappyCall(token, detailItem.id);
            await loadSchedule();
          }}
        />
      )}
    </div>
  );
}
