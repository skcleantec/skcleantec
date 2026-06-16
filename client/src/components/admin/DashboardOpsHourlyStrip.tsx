import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDashboardOpsHourly,
  type OpsHeatmap,
  type OpsHourlyMetric,
  type OpsHourlyMetricId,
  type OpsHourlySummary,
} from '../../api/dashboard';
import { getToken } from '../../stores/auth';
import { buildOpsDrillDownUrl } from '../../utils/opsDrillDown';
import { HelpTooltip } from '../ui/HelpTooltip';

const PERIOD_OPTIONS = [
  { days: 7 as const, label: '7일' },
  { days: 30 as const, label: '30일' },
  { days: 90 as const, label: '90일' },
];

const METRIC_ACCENT: Record<string, string> = {
  order_form_issued: 'bg-indigo-500',
  order_form_submitted: 'bg-sky-500',
  inquiry_received: 'bg-violet-500',
  followup_absent: 'bg-amber-500',
  followup_on_hold: 'bg-orange-400',
  followup_reserved: 'bg-emerald-500',
};

const PRIMARY_BOX_THEME: Record<
  'order_form_issued' | 'followup_absent',
  { border: string; bg: string; title: string; peak: string }
> = {
  order_form_issued: {
    border: 'border-indigo-200/80',
    bg: 'bg-indigo-50/40',
    title: 'text-indigo-900',
    peak: 'text-indigo-700',
  },
  followup_absent: {
    border: 'border-amber-200/80',
    bg: 'bg-amber-50/40',
    title: 'text-amber-950',
    peak: 'text-amber-800',
  },
};

const SECONDARY_METRIC_IDS: OpsHourlyMetricId[] = [
  'order_form_submitted',
  'inquiry_received',
  'followup_on_hold',
  'followup_reserved',
];

function formatHourRange(h: number): string {
  const hour = Math.max(0, Math.min(23, Math.floor(h)));
  const next = hour === 23 ? 0 : hour + 1;
  return `${hour}~${next}시`;
}

function HourlyBarChart({
  hourly,
  peakHour,
  accentClass,
  size = 'sm',
}: {
  hourly: number[];
  peakHour: number;
  accentClass: string;
  size?: 'sm' | 'md';
}) {
  const max = Math.max(...hourly, 1);
  const tall = size === 'md';
  const barAreaClass = tall ? 'h-20' : 'h-7';

  return (
    <div className="w-full" role="img" aria-label="0~23시(KST) 시간대별 건수 막대">
      <div className={`flex w-full items-end gap-px ${barAreaClass}`}>
        {hourly.map((v, h) => {
          const heightPct = v > 0 ? Math.max(12, Math.round((v / max) * 100)) : 8;
          const isPeak = v > 0 && h === peakHour;
          return (
            <div
              key={h}
              className="group/bar relative flex min-w-0 flex-1 h-full flex-col items-center justify-end"
            >
              {tall && v > 0 ? (
                <span
                  className={`mb-0.5 text-[9px] font-semibold leading-none tabular-nums ${
                    isPeak ? 'text-slate-800' : 'text-slate-500'
                  }`}
                >
                  {v}
                </span>
              ) : null}
              <div
                title={`${formatHourRange(h)} · ${v}건`}
                className={`w-full rounded-[2px] transition-opacity group-hover/bar:opacity-100 ${
                  v > 0
                    ? isPeak
                      ? accentClass
                      : 'bg-slate-300/90'
                    : 'bg-slate-200/60'
                } ${v > 0 ? 'opacity-90 group-hover/bar:ring-1 group-hover/bar:ring-slate-400/50' : ''}`}
                style={{ height: `${heightPct}%`, minHeight: v > 0 ? (tall ? '4px' : '2px') : '2px' }}
              />
              <div
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm group-hover/bar:block"
                aria-hidden
              >
                {formatHourRange(h)} · {v}건
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex w-full gap-px">
        {hourly.map((_, h) => (
          <div
            key={h}
            className="min-w-0 flex-1 text-center text-[8px] leading-none tabular-nums text-slate-400"
          >
            {h % 3 === 0 ? h : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpsPrimaryBox({
  metric,
  boxId,
  onDrill,
  footer,
}: {
  metric: OpsHourlyMetric;
  boxId: 'order_form_issued' | 'followup_absent';
  onDrill?: () => void;
  footer?: ReactNode;
}) {
  const theme = PRIMARY_BOX_THEME[boxId];
  const accent = METRIC_ACCENT[metric.id] ?? 'bg-slate-500';
  const clickable = metric.peakCount > 0 && onDrill;

  return (
    <div className={`flex min-w-0 flex-1 flex-col rounded-xl border ${theme.border} ${theme.bg} p-3`}>
      <button
        type="button"
        disabled={!clickable}
        onClick={clickable ? onDrill : undefined}
        className={`text-left ${clickable ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
        title={clickable ? `${metric.description} — 클릭하면 피크 시간대 목록으로 이동` : metric.description}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold ${theme.title}`}>{metric.label}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{metric.description}</p>
          </div>
          <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">
            {metric.total}건
          </span>
        </div>
        <p className={`mt-2 text-sm font-bold tabular-nums leading-tight ${theme.peak}`}>
          {metric.peakCount > 0 ? `${metric.peakLabel} · ${metric.peakCount}건` : '피크 없음'}
        </p>
      </button>
      <div className="mt-2">
        <HourlyBarChart hourly={metric.hourly} peakHour={metric.peakHour} accentClass={accent} size="md" />
      </div>
      {footer ? <div className="mt-2 border-t border-white/60 pt-2">{footer}</div> : null}
    </div>
  );
}

function OpsHourlyChip({
  metric,
  onDrill,
}: {
  metric: OpsHourlyMetric;
  onDrill?: () => void;
}) {
  const accent = METRIC_ACCENT[metric.id] ?? 'bg-slate-500';
  const clickable = metric.peakCount > 0 && onDrill;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onDrill : undefined}
      className={`flex min-w-[7.5rem] flex-1 flex-col gap-1 rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1.5 text-left transition ${
        clickable ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm' : 'cursor-default'
      }`}
      title={clickable ? `${metric.description} — 클릭하면 해당 시간대 목록으로 이동` : metric.description}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-medium text-slate-600">{metric.label}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{metric.total}건</span>
      </div>
      <p className="truncate text-[11px] font-semibold tabular-nums text-slate-900 leading-tight">
        {metric.peakCount > 0 ? `${metric.peakLabel} · ${metric.peakCount}건` : '—'}
      </p>
      <HourlyBarChart hourly={metric.hourly} peakHour={metric.peakHour} accentClass={accent} size="sm" />
    </button>
  );
}

function OpsHeatmapGrid({ heatmap }: { heatmap: OpsHeatmap }) {
  const max = Math.max(...heatmap.grid.flat(), 1);
  const peak = heatmap.peak;
  return (
    <div className="overflow-x-auto pb-0.5 [scrollbar-width:thin]">
      <div
        className="inline-grid min-w-full gap-px text-[9px] text-slate-400"
        style={{ gridTemplateColumns: '1.75rem repeat(24, minmax(0.65rem, 1fr))' }}
      >
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center tabular-nums">
            {h % 3 === 0 ? h : ''}
          </div>
        ))}
        {heatmap.grid.map((row, dow) => (
          <Fragment key={dow}>
            <div className="pr-1 text-right font-medium text-slate-500">{heatmap.weekdayLabels[dow]}</div>
            {row.map((v, hour) => {
              const isPeak = peak.count > 0 && peak.dow === dow && peak.hour === hour;
              const intensity = v > 0 ? Math.max(0.12, v / max) : 0;
              return (
                <div
                  key={hour}
                  title={`${heatmap.weekdayLabels[dow]} ${hour}시 · ${v}건`}
                  className={`aspect-square min-h-[0.65rem] rounded-[1px] ${
                    isPeak ? 'ring-1 ring-indigo-400' : ''
                  }`}
                  style={{
                    backgroundColor:
                      v > 0 ? `rgba(79, 70, 229, ${0.15 + intensity * 0.75})` : 'rgba(226, 232, 240, 0.5)',
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function DashboardOpsHourlyStrip() {
  const token = getToken();
  const navigate = useNavigate();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<OpsHourlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    getDashboardOpsHourly(token, days)
      .then((summary) => {
        if (!cancelled) {
          setData(summary);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : '불러오기 실패');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, days]);

  const issued = data?.metrics.find((m) => m.id === 'order_form_issued');
  const absent = data?.metrics.find((m) => m.id === 'followup_absent');
  const secondaryMetrics = data?.metrics.filter((m) => SECONDARY_METRIC_IDS.includes(m.id)) ?? [];

  const drill = (metricId: OpsHourlyMetricId) => {
    if (!data) return;
    navigate(buildOpsDrillDownUrl(metricId, data));
  };

  return (
    <section className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm shadow-slate-100/50">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="text-fluid-xs font-semibold text-slate-900">운영 시간대 (KST)</h2>
          <HelpTooltip text="막대에 마우스를 올리면 시간대·건수가 표시됩니다. 큰 박스는 막대 위 숫자와 하단 0·3·6…시(KST) 눈금을 함께 봅니다." />
        </div>
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                days === opt.days
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data && !loading ? (
        <p className="mb-3 text-[10px] text-slate-500">
          {data.periodStartYmd} ~ {data.periodEndYmd}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2 text-[11px] text-rose-700">{error}</p>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : data && issued && absent ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpsPrimaryBox
              metric={issued}
              boxId="order_form_issued"
              onDrill={() => drill('order_form_issued')}
              footer={
                data.heatmap.total > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setHeatmapOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 text-left text-[10px] font-medium text-indigo-800/80 hover:text-indigo-900"
                    >
                      <span>
                        요일×시간 히트맵
                        {data.heatmap.peak.count > 0 ? (
                          <span className="ml-1 font-normal">피크 {data.heatmap.peak.label}</span>
                        ) : null}
                      </span>
                      <span className="text-indigo-400">{heatmapOpen ? '접기' : '펼치기'}</span>
                    </button>
                    {heatmapOpen ? (
                      <div className="mt-2 rounded-lg bg-white/60 p-2">
                        <OpsHeatmapGrid heatmap={data.heatmap} />
                      </div>
                    ) : null}
                  </>
                ) : null
              }
            />
            <OpsPrimaryBox
              metric={absent}
              boxId="followup_absent"
              onDrill={() => drill('followup_absent')}
              footer={
                data.openBacklog.total > 0 || data.conversionByHour.peakRatePct > 0 ? (
                  <div className="space-y-1 text-[10px] text-slate-600">
                    {data.openBacklog.total > 0 ? (
                      <p>
                        현재 미처리{' '}
                        <span className="font-semibold tabular-nums text-amber-800">
                          {data.openBacklog.total}건
                        </span>
                        <span className="text-slate-400">
                          {' '}
                          (부재 {data.openBacklog.absent} · 보류 {data.openBacklog.onHold})
                        </span>
                      </p>
                    ) : null}
                    {data.conversionByHour.peakRatePct > 0 ? (
                      <p>
                        예약 전환 피크{' '}
                        <span className="font-semibold tabular-nums text-emerald-700">
                          {data.conversionByHour.peakRatePct}%
                        </span>
                        <span className="text-slate-400">
                          {' '}
                          ({data.conversionByHour.peakHour}~
                          {data.conversionByHour.peakHour === 23 ? 0 : data.conversionByHour.peakHour + 1}시)
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : null
              }
            />
          </div>

          {secondaryMetrics.length > 0 ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[10px] font-medium text-slate-500">보조 지표</p>
              <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                {secondaryMetrics.map((m) => (
                  <OpsHourlyChip key={m.id} metric={m} onDrill={() => drill(m.id)} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
