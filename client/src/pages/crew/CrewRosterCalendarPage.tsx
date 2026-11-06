import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import { getCrewDayRoster, type CrewMeResponse } from '../../api/crew';
import { kstTodayYmd, WEEKDAY_EN } from '../../utils/dateFormat';
import { CrewBiLine, useCrewText } from '../../i18n/crew/crewI18n';
import { useCrewUiLang, type CrewUiLangKey } from '../../i18n/crew/crewUiLanguageContext';
import { CREW_CARD } from './crewUi';

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

function rosterCountLabel(n: number, lang: CrewUiLangKey): string {
  if (lang === 'th') return `${n} คน`;
  return `${n}명`;
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
  const t = useCrewText();
  const uiLang = useCrewUiLang();

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
        if (!it || typeof it.date !== 'string' || !YMD_RE.test(it.date)) continue;
        const ids = Array.isArray(it.teamMemberIds)
          ? it.teamMemberIds
          : Array.isArray(it.members)
            ? it.members.map((m) => m.teamMemberId)
            : null;
        if (!ids) continue;
        next[it.date] = [...ids];
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
      <p className="text-[13px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <CrewBiLine id="crew.common.outletMissing" />
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
    'shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] font-medium text-slate-700 disabled:opacity-40';

  return (
    <div className="space-y-3 min-w-0">
      {/* ─── Header + month nav ─── */}
      <div className={`${CREW_CARD} px-3 py-2.5 space-y-2`}>
        <div className="flex items-start gap-2 min-w-0">
          <h1 className="text-[14px] font-semibold text-[#0F172A] leading-tight min-w-0 flex-1">
            <CrewBiLine id="crew.roster.title" />
          </h1>
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-label={t('crew.roster.helpToggleAria')}
            onClick={() => setHelpOpen((v) => !v)}
            className="shrink-0 min-h-9 min-w-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
          </button>
        </div>
        {helpOpen ? (
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] text-slate-600 leading-snug space-y-1">
            {canEdit ? <CrewBiLine id="crew.roster.hintEdit" /> : <CrewBiLine id="crew.roster.hintView" />}
            <CrewBiLine id="crew.roster.calendarNavHint" />
          </div>
        ) : null}
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" className={navBtn} onClick={goPrevMonth} aria-label={t('crew.roster.prevMonthAria')}>
            ‹
          </button>
          <select
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            className="min-w-0 flex-1 min-h-11 px-2 border border-slate-200 rounded-xl text-[13px] tabular-nums bg-white"
          >
            {yearOpts.map((yy) => (
              <option key={yy} value={yy}>{yy}</option>
            ))}
          </select>
          <select
            value={m}
            onChange={(e) => setM(Number(e.target.value))}
            className="min-w-0 flex-1 min-h-11 px-2 border border-slate-200 rounded-xl text-[13px] tabular-nums bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
              <option key={mm} value={mm}>{mm}월</option>
            ))}
          </select>
          <button type="button" className={navBtn} onClick={goNextMonth} aria-label={t('crew.roster.nextMonthAria')}>
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-slate-500 py-6 text-center">
          <CrewBiLine id="crew.common.loading" />
        </p>
      ) : (
        <div className={`${CREW_CARD} overflow-hidden`}>
          <div className="p-1.5">
            <div className="grid grid-cols-7 gap-px bg-slate-100 mb-px rounded-t-xl overflow-hidden">
              {WEEKDAY_EN.map((w, i) => (
                <div
                  key={w}
                  className={`text-center text-[12px] font-semibold py-1.5 bg-slate-50 ${
                    i === 0 ? 'text-red-600' : i === 6 ? 'text-[#1D4ED8]' : 'text-slate-600'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-100">
              {calendarDays.map((d, idx) => {
                if (d == null) {
                  return (
                    <div key={`e-${idx}`} className="min-h-[2.85rem] bg-slate-50 min-w-0" />
                  );
                }
                const key = ymd(d);
                const cnt = (byDay[key] ?? []).length;
                const isTodayCell = key === kstToday;
                const cntLabel = rosterCountLabel(cnt, uiLang);
                const wk = new Date(y, m - 1, d).getDay();
                const isSun = wk === 0;
                const isSat = wk === 6;
                const dayNumMuted = isSun ? 'text-red-600' : isSat ? 'text-[#1D4ED8]' : 'text-slate-700';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDay(d)}
                    title={key}
                    className="relative w-full min-h-[2.85rem] min-w-0 px-0.5 py-0.5 bg-white transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0F172A]"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 inline-flex h-5 min-w-[1.25rem] px-0.5 items-center justify-center text-[12px] font-bold tabular-nums leading-none ${
                        isTodayCell
                          ? 'rounded-full bg-[#0F172A] text-white'
                          : dayNumMuted
                      }`}
                    >
                      {d}
                    </span>
                    <div className="absolute bottom-0.5 left-0 right-0 px-0.5 flex flex-col items-center justify-end pointer-events-none">
                      {cnt > 0 ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-[#15803D]/10 text-[#15803D] px-1 py-px text-[11px] font-semibold tabular-nums leading-none">
                          {cntLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-400 px-1 py-px text-[11px] font-medium leading-none">
                          {t('crew.roster.unsetBadge')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[12px] text-slate-400 mt-1.5 text-center">
              {t('crew.roster.memberPoolHint')}{' '}
              <span className="tabular-nums">({members.length})</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
