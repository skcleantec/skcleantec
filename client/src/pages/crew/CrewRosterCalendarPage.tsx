import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import { getCrewDayRoster, type CrewMeResponse } from '../../api/crew';
import { kstTodayYmd, WEEKDAY_KO } from '../../utils/dateFormat';
import { CrewBiLine, crewT } from '../../i18n/crew/crewI18n';

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function monthRange(year: number, month: number) {
  const end = new Date(year, month, 0);
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(end.getDate())}`,
    daysInMonth: end.getDate(),
  };
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function getCalendarDays(year: number, month: number): (number | null)[] {
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

function rosterCountLabel(n: number): { ko: string; th: string } {
  return {
    ko: `${n}명`,
    th: `${n} คน`,
  };
}

export function CrewRosterCalendarPage() {
  const navigate = useNavigate();
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth() + 1);
  const [byDay, setByDay] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const canEdit = me?.crewViewerRole === 'LEADER';
  const { start, end } = monthRange(y, m);
  const members: CrewMeResponse['group']['members'] = me?.group.members ?? [];

  const load = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me) return;
    setLoading(true);
    try {
      const r = await getCrewDayRoster(token, start, end);
      const next: Record<string, string[]> = {};
      const items = Array.isArray(r.items) ? r.items : [];
      for (const it of items) {
        if (!it || typeof it.date !== 'string' || !Array.isArray(it.teamMemberIds)) continue;
        if (!YMD_RE.test(it.date)) continue;
        next[it.date] = [...it.teamMemberIds];
      }
      setByDay(next);
    } catch {
      setByDay({});
    } finally {
      setLoading(false);
    }
  }, [me, start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const calendarDays = useMemo(() => getCalendarDays(y, m), [y, m]);
  const kstToday = kstTodayYmd();
  const yearOpts = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const ymd = (day: number) => `${y}-${pad2(m)}-${pad2(day)}`;

  const openDay = (day: number) => {
    const key = ymd(day);
    navigate(`/crew/roster/${key}`);
  };

  if (!outlet) {
    return (
      <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
        화면 레이아웃을 불러오지 못했습니다. 상단 「홈」을 누른 뒤 다시 시도하거나 페이지를 새로고침해 주세요.
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-sm text-gray-500">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  return (
    <div className="space-y-3 min-w-0">
      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-2">
        <h1 className="text-sm font-semibold text-gray-900">
          <CrewBiLine id="crew.roster.title" koClassName="font-semibold" />
        </h1>
        <p className="text-[0.65rem] text-gray-500 mt-1 leading-snug">
          {canEdit ? <CrewBiLine id="crew.roster.hintEdit" /> : <CrewBiLine id="crew.roster.hintView" />}
        </p>
        <p className="text-[0.6rem] text-gray-500 mt-1">
          <CrewBiLine id="crew.roster.calendarNavHint" />
        </p>
        <div className="flex flex-wrap gap-2 items-center mt-2">
          <select
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            {yearOpts.map((yy) => (
              <option key={yy} value={yy}>
                {yy}년
              </option>
            ))}
          </select>
          <select
            value={m}
            onChange={(e) => setM(Number(e.target.value))}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
              <option key={mm} value={mm}>
                {mm}월
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 px-1">
          <CrewBiLine id="crew.common.loading" />
        </p>
      ) : (
        <div className="rounded-2xl border border-gray-200/90 bg-gradient-to-b from-gray-50/80 to-white shadow-sm overflow-hidden">
          <div className="p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
              {WEEKDAY_KO.map((w, i) => (
                <div
                  key={w}
                  className={`text-center text-[0.65rem] sm:text-[0.7rem] font-semibold py-2 rounded-xl tabular-nums ${
                    i === 0
                      ? 'text-red-600 bg-red-50/70'
                      : i === 6
                        ? 'text-blue-600 bg-blue-50/70'
                        : 'text-gray-600 bg-gray-100/90'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarDays.map((d, idx) => {
                if (d == null) {
                  return (
                    <div
                      key={`e-${idx}`}
                      className="min-h-[4rem] sm:min-h-[4.5rem] rounded-xl bg-gray-100/40 border border-transparent"
                    />
                  );
                }
                const key = ymd(d);
                const cnt = (byDay[key] ?? []).length;
                const isToday = key === kstToday;
                const { ko: cntKo, th: cntTh } = rosterCountLabel(cnt);
                const wk = new Date(y, m - 1, d).getDay();
                const isSun = wk === 0;
                const isSat = wk === 6;
                const dayNumClass = isSun
                  ? 'text-red-500'
                  : isSat
                    ? 'text-blue-600'
                    : isToday
                      ? 'text-indigo-700'
                      : 'text-gray-700';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDay(d)}
                    title={`${key}`}
                    className={`relative w-full min-h-[4rem] sm:min-h-[4.5rem] rounded-xl border text-left transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 ${
                      isToday
                        ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-violet-50/50 shadow-md ring-2 ring-indigo-200/80'
                        : 'border-gray-100 bg-white shadow-sm hover:border-gray-200 hover:shadow-md hover:bg-gray-50/90'
                    }`}
                  >
                    <span
                      className={`absolute top-1.5 left-2 text-[0.65rem] sm:text-[0.7rem] font-bold tabular-nums leading-none ${dayNumClass}`}
                    >
                      {d}
                    </span>
                    <div className="absolute bottom-1.5 left-0 right-0 px-1 flex flex-col items-center justify-end gap-0 pointer-events-none">
                      {cnt > 0 ? (
                        <>
                          <span className="inline-flex items-center justify-center rounded-full bg-emerald-100/95 text-emerald-900 px-1.5 py-0.5 text-[0.6rem] sm:text-[0.65rem] font-semibold tabular-nums shadow-sm border border-emerald-200/60">
                            {cntKo}
                          </span>
                          <span className="text-[0.5rem] sm:text-[0.55rem] text-emerald-800/90 font-medium tabular-nums leading-none mt-0.5">
                            {cntTh}
                          </span>
                        </>
                      ) : (
                        <span className="text-[0.55rem] text-gray-300 tabular-nums">·</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[0.6rem] text-gray-400 mt-3 text-center leading-snug">
              {crewT('crew.roster.memberPoolHint').ko} · {crewT('crew.roster.memberPoolHint').th}{' '}
              <span className="tabular-nums">({members.length})</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
