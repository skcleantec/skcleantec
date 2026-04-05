import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';
import { getTeamHolidayCalendar, type TeamCalendarDayEntry } from '../../api/dayoffs';
import { isPublicHoliday } from '../../utils/holidays';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(y: number, m: number, day: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function getMonthRange(year: number, month: number) {
  const end = new Date(year, month, 0);
  return {
    start: toDateKey(year, month, 1),
    end: toDateKey(year, month, end.getDate()),
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

function isTodayYmd(year: number, month: number, day: number): boolean {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() + 1 === month && t.getDate() === day;
}

export function AdminTeamHolidayCalendarPage() {
  const token = getToken();
  const now = new Date();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'other'>('loading');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [byDate, setByDate] = useState<Record<string, TeamCalendarDayEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setRoleGate('other');
      return;
    }
    getMe(token)
      .then((u: { role?: string }) => setRoleGate(u.role === 'ADMIN' ? 'admin' : 'other'))
      .catch(() => setRoleGate('other'));
  }, [token]);

  const load = useCallback(async () => {
    if (!token || roleGate !== 'admin') return;
    const { start, end } = getMonthRange(year, month);
    setLoading(true);
    setError(null);
    try {
      const res = await getTeamHolidayCalendar(token, start, end);
      setByDate(res.byDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      setByDate({});
    } finally {
      setLoading(false);
    }
  }, [token, roleGate, year, month]);

  useEffect(() => {
    if (roleGate === 'admin') load();
  }, [roleGate, load]);

  if (!token) return <Navigate to="/admin/login" replace />;
  if (roleGate === 'loading') {
    return <div className="text-sm text-gray-500 py-8">권한 확인 중…</div>;
  }
  if (roleGate !== 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const days = getCalendarDays(year, month);
  const monthLabel = `${year}년 ${month}월`;

  const goPrevMonth = () => {
    if (month <= 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedKey(null);
  };

  const goNextMonth = () => {
    if (month >= 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedKey(null);
  };

  const selectedEntry =
    selectedKey && byDate[selectedKey]
      ? byDate[selectedKey]
      : { teamLeaderOffs: [], teamMemberOffs: [] };

  return (
    <div className="flex flex-col gap-6 min-w-0 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">휴일 캘린더</h1>
        <p className="text-sm text-gray-600 mt-1">
          팀장 휴무(로그인 계정)와 현장 팀원 휴무를 월 단위로 한눈에 봅니다. 공휴일(고정)은 참고용으로 표시합니다.
          휴무 등록·변경은 각각{' '}
          <span className="text-gray-800">팀장 화면(휴무)</span> 또는 <span className="text-gray-800">팀원</span> 목록에서
          할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-500" aria-hidden />
          팀장 휴무
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sky-200 border border-sky-500" aria-hidden />
          팀원 휴무
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-300" aria-hidden />
          공휴일
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className="p-2 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="이전 달"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-[8rem] text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={goNextMonth}
            className="p-2 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="다음 달"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const t = new Date();
            setYear(t.getFullYear());
            setMonth(t.getMonth() + 1);
            setSelectedKey(null);
          }}
          className="text-sm px-3 py-1.5 border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
        >
          이번 달
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-6">불러오는 중…</div>
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={`text-center text-xs font-medium py-2 text-gray-600 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : ''}`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d, idx) => {
                if (d == null) {
                  return <div key={`pad-${idx}`} className="min-h-[5.5rem] bg-gray-50/80 border-b border-r border-gray-100" />;
                }
                const key = toDateKey(year, month, d);
                const entry = byDate[key] ?? { teamLeaderOffs: [], teamMemberOffs: [] };
                const tl = entry.teamLeaderOffs.length;
                const tm = entry.teamMemberOffs.length;
                const holiday = isPublicHoliday(year, month, d);
                const wday = new Date(year, month - 1, d).getDay();
                const isWeekend = wday === 0 || wday === 6;
                const isToday = isTodayYmd(year, month, d);
                const selected = selectedKey === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={`min-h-[5.5rem] text-left p-1.5 border-b border-r border-gray-100 flex flex-col gap-0.5 transition-colors ${
                      selected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/40 z-[1]' : 'hover:bg-gray-50/90'
                    } ${isWeekend ? 'bg-gray-50/50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          wday === 0 ? 'text-red-600' : wday === 6 ? 'text-blue-600' : 'text-gray-900'
                        } ${isToday ? 'underline decoration-2 underline-offset-2' : ''}`}
                      >
                        {d}
                      </span>
                      {holiday && (
                        <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-1 rounded border border-rose-200 shrink-0">
                          공휴
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-0.5 mt-auto">
                      {tl > 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          팀장 {tl}
                        </span>
                      )}
                      {tm > 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-400">
                          팀원 {tm}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              {selectedKey ? `${selectedKey} 상세` : '날짜를 선택하세요'}
            </h2>
            {selectedKey ? (
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">팀장 휴무</p>
                  {selectedEntry.teamLeaderOffs.length === 0 ? (
                    <p className="text-gray-500">없음</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-800 space-y-0.5">
                      {selectedEntry.teamLeaderOffs.map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">팀원 휴무</p>
                  {selectedEntry.teamMemberOffs.length === 0 ? (
                    <p className="text-gray-500">없음</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-800 space-y-0.5">
                      {selectedEntry.teamMemberOffs.map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">캘린더에서 날짜를 누르면 해당일 휴무 명단이 표시됩니다.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
