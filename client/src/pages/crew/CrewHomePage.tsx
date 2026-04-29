import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken, subscribeCrewAuth } from '../../stores/crewAuth';
import { getCrewMonthlyJobStats, getCrewStaffNotices, type CrewMonthlyJobStatItem, type CrewStaffNoticeItem } from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { CrewBiLine, crewT } from '../../i18n/crew/crewI18n';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

function kstMonthYmNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function addMonthsYm(ym: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  let y = Number(m[1]);
  let month = Number(m[2]) - 1 + delta;
  y += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  return `${y}-${String(month + 1).padStart(2, '0')}`;
}

function formatMonthKo(ym: string): string {
  const p = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!p) return ym;
  return `${p[1]}년 ${Number(p[2])}월`;
}

function formatMonthTh(ym: string): string {
  const p = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!p) return ym;
  const y = Number(p[1]);
  const mo = Number(p[2]);
  const d = new Date(`${y}-${String(mo).padStart(2, '0')}-15T12:00:00+09:00`);
  try {
    return new Intl.DateTimeFormat('th-TH', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Seoul',
    }).format(d);
  } catch {
    return ym;
  }
}

export function CrewHomePage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const crewToken = useSyncExternalStore(subscribeCrewAuth, getCrewToken, () => null);

  const [statsMonth, setStatsMonth] = useState(kstMonthYmNow);
  const [stats, setStats] = useState<CrewMonthlyJobStatItem[] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);

  const [staffNotices, setStaffNotices] = useState<CrewStaffNoticeItem[]>([]);
  const [staffNoticesLoading, setStaffNoticesLoading] = useState(false);

  const loadStaffNotices = useCallback(async () => {
    const token = getCrewToken();
    if (!token) return;
    setStaffNoticesLoading(true);
    try {
      const { items } = await getCrewStaffNotices(token);
      setStaffNotices(items);
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        setStaffNotices([]);
        return;
      }
      setStaffNotices([]);
    } finally {
      setStaffNoticesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    void loadStaffNotices();
  }, [me, loadStaffNotices]);

  useInboxRealtime(crewToken ?? '', loadStaffNotices, Boolean(crewToken && me));

  const loadStats = useCallback(async (month: string) => {
    const token = getCrewToken();
    if (!token) return;
    setStatsLoading(true);
    setStatsError(false);
    try {
      const data = await getCrewMonthlyJobStats(token, month);
      setStats(data.items);
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        setStats(null);
        return;
      }
      setStatsError(true);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    void loadStats(statsMonth);
  }, [me, statsMonth, loadStats]);

  const chartRows = useMemo(() => {
    if (!stats) return [];
    return [...stats].sort(
      (a, b) =>
        b.inquiryCount - a.inquiryCount || a.name.localeCompare(b.name, 'ko'),
    );
  }, [stats]);

  const maxCount = useMemo(() => Math.max(1, ...chartRows.map((r) => r.inquiryCount)), [chartRows]);

  if (!outlet) {
    return (
      <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
        화면 레이아웃을 불러오지 못했습니다. 상단 메뉴를 눌러 다시 시도하거나 페이지를 새로고침해 주세요.
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
    <div className="min-w-0">
      <section className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 shrink-0">사무실 공지</h2>
          {staffNoticesLoading ? (
            <span className="text-[10px] text-slate-400 truncate">불러오는 중…</span>
          ) : null}
        </div>
        {!staffNoticesLoading && staffNotices.length === 0 ? (
          <p className="text-xs text-slate-500">등록된 공지가 없습니다.</p>
        ) : staffNoticesLoading && staffNotices.length === 0 ? (
          <p className="text-xs text-slate-500">불러오는 중…</p>
        ) : (
          <ul className="space-y-2 max-h-52 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
            {staffNotices.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-100 bg-slate-50/90 px-2.5 py-2 text-xs min-w-0">
                <p className="font-medium text-slate-800 whitespace-pre-wrap break-words">{n.content}</p>
                <p className="mt-1 text-[10px] text-slate-500 tabular-nums truncate" title={n.sender.name}>
                  {n.sender.name} · {formatDateTimeCompactWithWeekday(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-indigo-100/80 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-[0_4px_24px_-4px_rgba(79,70,229,0.12)] overflow-hidden">
        <div className="px-3 py-2.5 flex items-center gap-2 min-w-0 border-b border-indigo-100/60 bg-white/70 backdrop-blur-sm">
          <button
            type="button"
            className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-sm"
            aria-label={`${crewT('crew.home.prevMonthAria').ko} / ${crewT('crew.home.prevMonthAria').th}`}
            onClick={() => setStatsMonth((ym) => addMonthsYm(ym, -1))}
          >
            ‹
          </button>
          <div className="flex-1 min-w-0 text-center">
            <div className="text-xs font-semibold text-slate-900">{formatMonthKo(statsMonth)}</div>
            <div className="text-[0.58rem] text-indigo-700/90 leading-tight">{formatMonthTh(statsMonth)}</div>
          </div>
          <button
            type="button"
            className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-sm"
            aria-label={`${crewT('crew.home.nextMonthAria').ko} / ${crewT('crew.home.nextMonthAria').th}`}
            onClick={() => setStatsMonth((ym) => addMonthsYm(ym, 1))}
          >
            ›
          </button>
        </div>

        <div className="px-3 py-3 space-y-3">
          <h3 className="text-[0.7rem] font-semibold text-slate-800">
            <CrewBiLine id="crew.home.statsTitle" koClassName="font-semibold" />
          </h3>

          {statsLoading ? (
            <p className="text-[0.65rem] text-slate-500 py-4 text-center">
              {crewT('crew.home.statsLoading').ko} / {crewT('crew.home.statsLoading').th}
            </p>
          ) : statsError ? (
            <p className="text-[0.65rem] text-red-600 py-2 text-center">
              {crewT('crew.home.statsError').ko} / {crewT('crew.home.statsError').th}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {chartRows.map((row, idx) => {
                const th = (row.nameTh ?? '').trim();
                const label = th ? `${row.name} · ${th}` : row.name;
                const pct = (row.inquiryCount / maxCount) * 100;
                const inactive = !row.isActive;
                const nameCls = inactive ? 'text-slate-400 line-through' : 'text-slate-800';
                const thCls = inactive ? 'text-slate-400' : 'text-indigo-700';
                return (
                  <li key={row.teamMemberId} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1 min-w-0">
                      <div className="min-w-0 flex-1 flex items-baseline gap-1">
                        <span className="tabular-nums text-slate-400 shrink-0 w-4 text-right text-[0.68rem]">
                          {idx + 1}.
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate text-[0.68rem] font-medium ${nameCls}`}
                          title={label}
                        >
                          {row.name}
                        </span>
                        {th ? (
                          <span
                            className={`shrink-0 text-[0.62rem] font-medium max-w-[42%] sm:max-w-[55%] truncate ${thCls}`}
                            title={th}
                          >
                            · {th}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 text-[0.68rem] tabular-nums font-semibold ${
                          row.inquiryCount > 0 ? 'text-indigo-700' : 'text-slate-400'
                        }`}
                      >
                        {row.inquiryCount}
                        <span className="text-[0.58rem] font-normal text-slate-500 ml-0.5">
                          {crewT('crew.home.statsUnit').ko}/{crewT('crew.home.statsUnit').th}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100/90 overflow-hidden ring-1 ring-inset ring-slate-200/50">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                          inactive
                            ? 'bg-slate-300/80'
                            : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[0.55rem] text-slate-500 leading-snug pt-1 border-t border-slate-100">
            <CrewBiLine id="crew.home.statsFootnote" />
          </p>
        </div>
      </section>
    </div>
  );
}
