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
import { CREW_CARD } from './crewUi';

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
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-gray-600">
        <CrewBiLine id="crew.common.outletMissing" />
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-[13px] text-gray-500">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <section className={`${CREW_CARD} min-w-0 px-3 py-3`}>
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0F172A]"
            aria-hidden
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
          <h2 className="min-w-0 flex-1 text-[14px] font-semibold text-[#0F172A]">
            <CrewBiLine id="crew.home.noticeTitle" />
          </h2>
          {staffNoticesLoading ? (
            <span className="truncate text-[12px] text-slate-400">
              <CrewBiLine id="crew.common.loading" />
            </span>
          ) : null}
        </div>
        {!staffNoticesLoading && staffNotices.length === 0 ? (
          <p className="text-[12px] text-slate-500">
            <CrewBiLine id="crew.home.noticeEmpty" />
          </p>
        ) : staffNoticesLoading && staffNotices.length === 0 ? (
          <p className="text-[12px] text-slate-500">
            <CrewBiLine id="crew.common.loading" />
          </p>
        ) : (
          <ul className="max-h-52 space-y-2 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
            {staffNotices.map((n) => (
              <li key={n.id} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/90 px-2.5 py-2 text-[12px]">
                <p className="whitespace-pre-wrap break-words font-medium text-slate-800">{n.content}</p>
                <p className="mt-1 truncate text-[12px] tabular-nums text-slate-500" title={n.sender.name}>
                  {n.sender.name} · {formatDateTimeCompactWithWeekday(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${CREW_CARD} overflow-hidden`}>
        {payDayGroups.length > 0 ? (
          <div className="border-b border-slate-100 bg-slate-50/60 px-3 pb-2 pt-2.5">
            <div className="flex flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]">
              {payDayGroups.map((day) => {
                const active = selectedPayDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    className={`min-h-11 shrink-0 rounded-xl border px-3 text-[12px] font-semibold transition-colors ${
                      active
                        ? 'border-[#0F172A] bg-[#0F172A] text-white'
                        : 'border-slate-200 bg-white text-slate-700'
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

        <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[15px] text-slate-600 disabled:opacity-40"
            aria-label={t('crew.home.prevMonthAria')}
            disabled={!canShiftCycle || statsLoading}
            onClick={() => shiftCycle(-1)}
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[13px] font-semibold tabular-nums text-[#0F172A]" title={periodLabel}>
              {periodLabel || '—'}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[15px] text-slate-600 disabled:opacity-40"
            aria-label={t('crew.home.nextMonthAria')}
            disabled={!canShiftCycle || statsLoading}
            onClick={() => shiftCycle(1)}
          >
            ›
          </button>
        </div>

        <div className="space-y-3 px-3 py-3">
          <h3 className="text-[13px] font-semibold text-[#0F172A]">
            <CrewBiLine id="crew.home.statsTitle" koClassName="font-semibold" />
          </h3>

          {statsLoading ? (
            <p className="py-4 text-center text-[12px] text-slate-500">{t('crew.home.statsLoading')}</p>
          ) : statsError ? (
            <p className="py-2 text-center text-[12px] text-red-600">{t('crew.home.statsError')}</p>
          ) : payDayGroups.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-slate-500">
              <CrewBiLine id="crew.home.statsNoPayDay" />
            </p>
          ) : (
            <ul className="space-y-2.5">
              {chartRows.map((row, idx) => {
                const th = row.nameTh?.trim() ? row.nameTh.trim() : '';
                const inactive = !row.isActive;
                const nameCls = inactive ? 'text-slate-400 line-through' : 'text-slate-800';
                const thCls = inactive ? 'text-slate-400' : 'text-slate-500';
                const pct = (row.inquiryCount / maxCount) * 100;
                return (
                  <li key={row.teamMemberId} className="min-w-0">
                    <div className="mb-1 flex min-w-0 items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-1">
                          <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-slate-400">
                            {idx + 1}.
                          </span>
                          <span className={`min-w-0 truncate text-[12px] font-medium ${nameCls}`} title={row.name}>
                            {row.name}
                          </span>
                          {th ? (
                            <span className={`max-w-[45%] shrink-0 truncate text-[12px] font-medium ${thCls}`} title={th}>
                              · {th}
                            </span>
                          ) : null}
                        </div>
                        {memberPeriodLabel ? (
                          <p className="truncate pl-6 text-[12px] tabular-nums text-slate-400" title={memberPeriodLabel}>
                            {memberPeriodLabel}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 text-[12px] font-semibold tabular-nums ${
                          row.inquiryCount > 0 ? 'text-[#0F172A]' : 'text-slate-400'
                        }`}
                      >
                        {row.inquiryCount}
                        <span className="ml-0.5 text-[12px] font-normal text-slate-500">{statsUnit}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                          inactive ? 'bg-slate-300' : 'bg-[#0F172A]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="border-t border-slate-100 pt-2 text-[12px] leading-snug text-slate-500">
            <CrewBiLine id="crew.home.statsFootnote" />
          </p>
        </div>
      </section>
    </div>
  );
}
