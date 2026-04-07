import { useState, useEffect } from 'react';
import { getMyDayOffs, addDayOff, removeDayOff } from '../../api/dayoffs';
import { getTeamToken } from '../../stores/teamAuth';

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateLabelYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return ymd;
  return `${y}년 ${m}월 ${d}일`;
}

export function TeamDayOffsPage() {
  const token = getTeamToken();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    queueMicrotask(() => setLoading(true));
    const { start, end } = getMonthRange(year, month);
    getMyDayOffs(token, start, end)
      .then((res) => setDayOffDates(new Set(res.items)))
      .catch(() => setDayOffDates(new Set()))
      .finally(() => setLoading(false));
  }, [token, year, month]);

  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  const toggleDayOff = async (d: number) => {
    if (!token) return;
    const key = getDateKey(d);
    const isOff = dayOffDates.has(key);
    const label = formatDateLabelYmd(key);
    if (isOff) {
      if (!window.confirm(`${label} 휴무를 취소하시겠습니까?`)) return;
    } else {
      if (!window.confirm(`${label}을(를) 휴무일로 지정하시겠습니까?`)) return;
    }
    try {
      if (isOff) {
        await removeDayOff(token, key);
        setDayOffDates((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else {
        await addDayOff(token, key);
        setDayOffDates((prev) => new Set(prev).add(key));
      }
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const calendarDays = getCalendarDays(year, month);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h1 className="text-xl font-semibold text-gray-800">휴무일 설정</h1>
      <p className="text-sm text-gray-600">
        날짜를 누르면 휴무 지정 또는 취소를 확인한 뒤 반영됩니다. 관리자 캘린더에 반영됩니다.
      </p>

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
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 text-center text-xs">
            {WEEKDAYS.map((w, wi) => (
              <div
                key={w}
                className={`py-2 font-medium ${wi === 6 ? 'text-blue-600' : 'text-gray-600'}`}
              >
                {w}
              </div>
            ))}
            {calendarDays.map((d, i) => {
              if (d === null) {
                return <div key={`e-${i}`} className="min-h-[44px] bg-gray-50" />;
              }
              const key = getDateKey(d);
              const isOff = dayOffDates.has(key);
              return (
                <div
                  key={key}
                  onClick={() => toggleDayOff(d)}
                  className={`min-h-[44px] py-2 cursor-pointer border-b border-r border-gray-100 ${
                    isOff ? 'bg-red-100 text-red-700 font-medium' : 'hover:bg-gray-50'
                  }`}
                >
                  {d}
                  {isOff && <span className="block text-[10px]">휴무</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500">
        <span className="inline-block w-4 h-4 bg-red-100 rounded mr-1 align-middle" />
        붉은색 = 휴무일
      </div>
    </div>
  );
}
