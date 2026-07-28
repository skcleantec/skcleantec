import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken, subscribeCrewAuth } from '../../stores/crewAuth';
import {
  getCrewMonthlyJobStats,
  getCrewStaffNotices,
  type CrewMonthlyJobStatItem,
  type CrewStaffNoticeItem,
} from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { CrewBiLine, useCrewText } from '../../i18n/crew/crewI18n';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';
import { formatYmdDot, shiftPayrollCyclePayYmd } from '../../utils/payrollCycleClient';

export function CrewHomePage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const crewToken = useSyncExternalStore(subscribeCrewAuth, getCrewToken, () => null);
  const t = useCrewText();

  const [selectedPayDay, setSelectedPayDay] = useState<number | null>(null);
  /** null이면 서버가 해당 그룹의 현재 급여 주기를 선택 */
  const [queryPayYmd, setQueryPayYmd] = useState<string | null>(null);
  const [resolvedPayYmd, setResolvedPayYmd] = useState<string | null>(null);
  const [payDayGroups, setPayDayGroups] = useState<number[]>([]);
  const [cycleStartYmd, setCycleStartYmd] = useState<string | null>(null);
  const [cycleEndYmd, setCycleEndYmd] = useState<string | null>(null);
  const [workCountMode, setWorkCountMode] = useState<'DISTINCT_DAY' | 'PER_INQUIRY'>('DISTINCT_DAY');
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

  const loadStats = useCallback(
    async (payDay: number | null, payYmd: string | null) => {
      const token = getCrewToken();
      if (!token) return;
      setStatsLoading(true);
      setStatsError(false);
      try {
        const data = await getCrewMonthlyJobStats(token, {
          monthlyPayDay: payDay ?? undefined,
          payYmd: payYmd ?? undefined,
        });
        setPayDayGroups(data.payDayGroups);
        if (data.monthlyPayDay != null) setSelectedPayDay(data.monthlyPayDay);
        setCycleStartYmd(data.startYmd);
        setCycleEndYmd(data.endYmd);
        setWorkCountMode(data.workCountMode ?? 'DISTINCT_DAY');
        if (payYmd != null) {
          setQueryPayYmd(data.payYmd);
          setResolvedPayYmd(data.payYmd);
        } else {
          setResolvedPayYmd(data.payYmd);
        }
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
    },
    [],
  );

  useEffect(() => {
    if (!me) return;
    void loadStats(selectedPayDay, queryPayYmd);
  }, [me, selectedPayDay, queryPayYmd, loadStats]);

  const effectivePayYmd = queryPayYmd ?? resolvedPayYmd;

  const chartRows = useMemo(() => {
    if (!stats) return [];
    return [...stats].sort(
      (a, b) =>
        b.inquiryCount - a.inquiryCount || a.name.localeCompare(b.name, 'ko'),
    );
  }, [stats]);

  const maxCount = useMemo(() => Math.max(1, ...chartRows.map((r) => r.inquiryCount)), [chartRows]);

  const periodLabel = useMemo(() => {
    if (!cycleStartYmd || !cycleEndYmd) return '';
    return t('crew.home.statsPeriodRange', {
      start: formatYmdDot(cycleStartYmd),
      end: formatYmdDot(cycleEndYmd),
    });
  }, [cycleStartYmd, cycleEndYmd, t]);

  const memberPeriodLabel = useMemo(() => {
    if (!cycleStartYmd || !cycleEndYmd) return '';
    return t('crew.home.statsMemberPeriod', {
      start: formatYmdDot(cycleStartYmd),
      end: formatYmdDot(cycleEndYmd),
    });
  }, [cycleStartYmd, cycleEndYmd, t]);

  const statsUnit =
    workCountMode === 'PER_INQUIRY' ? t('crew.home.statsUnitInquiry') : t('crew.home.statsUnitDay');

  const canShiftCycle =
    selectedPayDay != null &&
    effectivePayYmd != null &&
    /^\d{4}-\d{2}-\d{2}$/.test(effectivePayYmd);

  const shiftCycle = (delta: number) => {
    if (!canShiftCycle || selectedPayDay == null || effectivePayYmd == null) return;
    const next = shiftPayrollCyclePayYmd(effectivePayYmd, selectedPayDay, delta);
    if (next) setQueryPayYmd(next);
  };

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
        {payDayGroups.length > 0 ? (
          <div className="px-3 pt-2.5 pb-2 border-b border-indigo-100/60 bg-white/70 backdrop-blur-sm">
            <div className="flex flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] pb-0.5">
              {payDayGroups.map((day) => {
                const active = selectedPayDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    className={`shrink-0 rounded-lg border px-2.5 py-1 text-[0.65rem] font-medium transition-colors ${
                      active
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setSelectedPayDay(day);
                      setQueryPayYmd(null);
                      setResolvedPayYmd(null);
                    }}
                  >
                    {t('crew.home.payDayGroupLabel', { day: String(day) })}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="px-3 py-2.5 flex items-center gap-2 min-w-0 border-b border-indigo-100/60 bg-white/70 backdrop-blur-sm">
          <button
            type="button"
            className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-sm disabled:opacity-40"
            aria-label={t('crew.home.prevMonthAria')}
            disabled={!canShiftCycle || statsLoading}
            onClick={() => shiftCycle(-1)}
          >
            ‹
          </button>
          <div className="flex-1 min-w-0 text-center">
            <div className="text-[0.68rem] font-semibold text-slate-900 tabular-nums truncate" title={periodLabel}>
              {periodLabel || '—'}
            </div>
            {selectedPayDay != null ? (
              <div className="text-[0.58rem] text-slate-500 mt-0.5">
                {t('crew.home.payDayGroupLabel', { day: String(selectedPayDay) })}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-sm disabled:opacity-40"
            aria-label={t('crew.home.nextMonthAria')}
            disabled={!canShiftCycle || statsLoading}
            onClick={() => shiftCycle(1)}
          >
            ›
          </button>
        </div>

        <div className="px-3 py-3 space-y-3">
          <h3 className="text-[0.7rem] font-semibold text-slate-800">
            <CrewBiLine id="crew.home.statsTitle" koClassName="font-semibold" />
          </h3>

          {statsLoading ? (
            <p className="text-[0.65rem] text-slate-500 py-4 text-center">{t('crew.home.statsLoading')}</p>
          ) : statsError ? (
            <p className="text-[0.65rem] text-red-600 py-2 text-center">{t('crew.home.statsError')}</p>
          ) : payDayGroups.length === 0 ? (
            <p className="text-[0.65rem] text-slate-500 py-4 text-center">
              <CrewBiLine id="crew.home.statsNoPayDay" />
            </p>
          ) : (
            <ul className="space-y-2.5">
              {chartRows.map((row, idx) => {
                const th = row.nameTh?.trim() ? row.nameTh.trim() : '';
                const inactive = !row.isActive;
                const nameCls = inactive ? 'text-slate-400 line-through' : 'text-slate-800';
                const thCls = inactive ? 'text-slate-400' : 'text-indigo-700';
                const pct = (row.inquiryCount / maxCount) * 100;
                return (
                  <li key={row.teamMemberId} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1 min-w-0">
                          <span className="tabular-nums text-slate-400 shrink-0 w-4 text-right text-[0.68rem]">
                            {idx + 1}.
                          </span>
                          <span
                            className={`min-w-0 truncate text-[0.68rem] font-medium ${nameCls}`}
                            title={row.name}
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
                        {memberPeriodLabel ? (
                          <p className="text-[0.58rem] text-slate-500 tabular-nums pl-5 truncate" title={memberPeriodLabel}>
                            {memberPeriodLabel}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 text-[0.68rem] tabular-nums font-semibold ${
                          row.inquiryCount > 0 ? 'text-indigo-700' : 'text-slate-400'
                        }`}
                      >
                        {row.inquiryCount}
                        <span className="text-[0.58rem] font-normal text-slate-500 ml-0.5">
                          {statsUnit}
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
