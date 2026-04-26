import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import { getCrewDayRoster, type CrewMeResponse } from '../../api/crew';
import { kstTodayYmd, WEEKDAY_EN } from '../../utils/dateFormat';
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
  const [helpOpen, setHelpOpen] = useState(false);

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
  const yearOpts = useMemo(() => {
    const base = new Date().getFullYear();
    const lo = Math.min(base - 2, y - 1);
    const hi = Math.max(base + 2, y + 1);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [y]);

  const ymd = (day: number) => `${y}-${pad2(m)}-${pad2(day)}`;

  const goPrevMonth = () => {
    if (m <= 1) {
      setM(12);
      setY((yy) => yy - 1);
    } else {
      setM(m - 1);
    }
  };

  const goNextMonth = () => {
    if (m >= 12) {
      setM(1);
      setY((yy) => yy + 1);
    } else {
      setM(m + 1);
    }
  };

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

  const navBtn =
    'shrink-0 flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 text-sm font-semibold shadow-sm active:bg-gray-100 disabled:opacity-40';

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="bg-white border border-gray-200 rounded-lg px-2 py-1.5">
        <div className="flex items-start gap-1.5 min-w-0">
          <h1 className="text-xs font-semibold text-gray-900 leading-tight min-w-0 flex-1">
            <CrewBiLine id="crew.roster.title" koClassName="font-semibold" />
          </h1>
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-label={`${crewT('crew.roster.helpToggleAria').ko} / ${crewT('crew.roster.helpToggleAria').th}`}
            onClick={() => setHelpOpen((v) => !v)}
            className="shrink-0 w-6 h-6 rounded-full border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
          </button>
        </div>
        {helpOpen ? (
          <div className="mt-1 p-2 rounded-md border border-gray-200 bg-gray-50 text-[0.58rem] text-gray-600 leading-snug space-y-1.5">
            {canEdit ? <CrewBiLine id="crew.roster.hintEdit" /> : <CrewBiLine id="crew.roster.hintView" />}
            <CrewBiLine id="crew.roster.calendarNavHint" />
          </div>
        ) : null}
        <div className="flex items-center gap-1 mt-1 min-w-0">
          <button
            type="button"
            className={navBtn}
            onClick={goPrevMonth}
            aria-label={`${crewT('crew.roster.prevMonthAria').ko} / ${crewT('crew.roster.prevMonthAria').th}`}
          >
            ‹
          </button>
          <select
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            className="min-w-0 flex-1 max-w-[5.5rem] px-1.5 py-1 border border-gray-300 rounded text-[0.7rem] tabular-nums"
          >
            {yearOpts.map((yy) => (
              <option key={yy} value={yy}>
                {yy}
              </option>
            ))}
          </select>
          <select
            value={m}
            onChange={(e) => setM(Number(e.target.value))}
            className="min-w-0 flex-1 max-w-[4.5rem] px-1.5 py-1 border border-gray-300 rounded text-[0.7rem] tabular-nums"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
              <option key={mm} value={mm}>
                {mm}월
              </option>
            ))}
          </select>
          <button
            type="button"
            className={navBtn}
            onClick={goNextMonth}
            aria-label={`${crewT('crew.roster.nextMonthAria').ko} / ${crewT('crew.roster.nextMonthAria').th}`}
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500 px-0.5">
          <CrewBiLine id="crew.common.loading" />
        </p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-200/90 p-px shadow-sm overflow-hidden">
          <div className="bg-white p-1 sm:p-1.5">
            <div className="grid grid-cols-7 gap-px bg-gray-200/90 mb-px">
              {WEEKDAY_EN.map((w, i) => (
                <div
                  key={w}
                  className={`text-center text-[0.58rem] font-semibold py-1 tabular-nums bg-gray-100 ${
                    i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200/90">
              {calendarDays.map((d, idx) => {
                if (d == null) {
                  return (
                    <div
                      key={`e-${idx}`}
                      className="min-h-[2.85rem] sm:min-h-[3.1rem] bg-gray-50/90 min-w-0"
                    />
                  );
                }
                const key = ymd(d);
                const cnt = (byDay[key] ?? []).length;
                const isTodayCell = key === kstToday;
                const { ko: cntKo, th: cntTh } = rosterCountLabel(cnt);
                const wk = new Date(y, m - 1, d).getDay();
                const isSun = wk === 0;
                const isSat = wk === 6;
                const dayNumMuted = isSun ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-gray-800';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDay(d)}
                    title={`${key}`}
                    className="relative w-full min-h-[2.85rem] sm:min-h-[3.1rem] min-w-0 px-0.5 py-0.5 bg-white text-left transition-colors hover:bg-gray-50/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] px-0.5 items-center justify-center text-[0.58rem] font-bold tabular-nums leading-none sm:h-5 sm:min-w-[1.25rem] sm:text-[0.62rem] ${
                        isTodayCell
                          ? 'rounded-full bg-gray-900 text-white shadow-sm ring-1 ring-gray-700/90'
                          : dayNumMuted
                      }`}
                    >
                      {d}
                    </span>
                    <div className="absolute bottom-0.5 left-0 right-0 px-0.5 flex flex-col items-center justify-end gap-0 pointer-events-none">
                      {cnt > 0 ? (
                        <>
                          <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-900 px-1 py-px text-[0.55rem] font-semibold tabular-nums leading-none border border-emerald-200/70">
                            {cntKo}
                          </span>
                          <span className="text-[0.48rem] text-emerald-800/85 font-medium tabular-nums leading-none">
                            {cntTh}
                          </span>
                        </>
                      ) : (
                        <span className="text-[0.5rem] text-gray-300 tabular-nums">·</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[0.55rem] text-gray-400 mt-1 text-center leading-none">
              {crewT('crew.roster.memberPoolHint').ko}/{crewT('crew.roster.memberPoolHint').th}{' '}
              <span className="tabular-nums">({members.length})</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
