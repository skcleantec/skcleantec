import { useState, useEffect } from 'react';
import { getSchedule, type ScheduleItem } from '../../api/schedule';
import { getToken } from '../../stores/auth';

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: '접수',
  ASSIGNED: '분배',
  IN_PROGRESS: '진행',
  COMPLETED: '완료',
  CS_PROCESSING: 'C/S처리중',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatRoomInfo(r: number | null, b: number | null, v: number | null) {
  const parts = [];
  if (r != null) parts.push(`${r}방`);
  if (b != null) parts.push(`${b}화`);
  if (v != null) parts.push(`${v}베`);
  return parts.length ? parts.join(' ') : '-';
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

function DetailModal({ item, onClose }: { item: ScheduleItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">상세 내역</h2>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <span className="text-gray-500 block text-xs">고객명</span>
            <span className="font-medium text-gray-900">{item.customerName}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">연락처</span>
            <span className="text-gray-800 break-all">{item.customerPhone}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">주소</span>
            <span className="text-gray-800 break-words">
              {item.address}
              {item.addressDetail ? ` ${item.addressDetail}` : ''}
            </span>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-gray-500 block text-xs">평수</span>
              <span>{item.areaPyeong ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">방·화·베</span>
              <span>{formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-gray-500 block text-xs">예약일</span>
              <span>{item.preferredDate ? new Date(item.preferredDate).toLocaleDateString('ko-KR') : '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">희망 시간</span>
              <span>{item.preferredTime || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">담당</span>
            <span>{item.assignments[0]?.teamLeader?.name ?? '미배정'}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">상태</span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-200">
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          {item.claimMemo && (
            <div>
              <span className="text-gray-500 block text-xs">C/S 내용</span>
              <span className="text-gray-800 break-words">{item.claimMemo}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function AdminSchedulePage() {
  const token = getToken();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<ScheduleItem | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const { start, end } = getMonthRange(year, month);
    getSchedule(token, start, end)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token, year, month]);

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
          {/* 달력 그리드 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 text-center text-xs sm:text-sm">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-2 font-medium text-gray-600 border-b border-r border-gray-200 last:border-r-0">
                  {w}
                </div>
              ))}
              {calendarDays.map((d, i) => {
                if (d === null) {
                  return <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[90px] bg-gray-50" />;
                }
                const key = getDateKey(d);
                const dayItems = byDate[key] || [];
                const hasEvents = dayItems.length > 0;
                const isSelected = selectedDate === key;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    className={`min-h-[70px] sm:min-h-[90px] p-1 border-b border-r border-gray-200 last:border-r-0 cursor-pointer flex flex-col items-center justify-start overflow-hidden ${
                      hasEvents ? 'bg-blue-50' : ''
                    } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`text-sm font-medium shrink-0 ${hasEvents ? 'text-blue-700' : 'text-gray-800'}`}>
                      {d}
                    </span>
                    {hasEvents && (
                      <div className="mt-0.5 flex flex-col gap-0.5 items-start w-full min-w-0 overflow-hidden text-left flex-1">
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] shrink-0">
                          {dayItems.length}건
                        </span>
                        {dayItems.slice(0, 3).map((item) => (
                          <span
                            key={item.id}
                            className="text-[10px] sm:text-xs text-gray-700 truncate w-full max-w-full px-0.5"
                            title={item.customerName}
                          >
                            {item.customerName}
                          </span>
                        ))}
                        {dayItems.length > 3 && (
                          <span className="text-[10px] text-gray-500 px-0.5">
                            외 {dayItems.length - 3}건
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택한 날짜의 일정 목록 + 상세 보기 */}
          {selectedDate && byDate[selectedDate] && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-base font-medium text-gray-800 mb-3">
                {new Date(selectedDate).toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}{' '}
                ({byDate[selectedDate].length}건)
              </h3>
              <div className="flex flex-col gap-2">
                {byDate[selectedDate].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDetailItem(item)}
                    className="text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 flex flex-col gap-1"
                  >
                    <span className="font-medium text-gray-900">{item.customerName}</span>
                    <span className="text-xs text-gray-600 truncate">
                      {item.address}
                      {item.addressDetail ? ` ${item.addressDetail}` : ''}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.preferredTime || '-'} · {item.assignments[0]?.teamLeader?.name ?? '미배정'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {detailItem && (
        <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}
