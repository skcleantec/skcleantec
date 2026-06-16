import { Fragment, useEffect, useState } from 'react';
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

function MiniHourBars({ hourly, peakHour, accentClass }: { hourly: number[]; peakHour: number; accentClass: string }) {
  const max = Math.max(...hourly, 1);
  return (
    <div className="flex h-3 w-full items-end gap-px" aria-hidden>
      {hourly.map((v, h) => (
        <div
          key={h}
          className={`min-w-0 flex-1 rounded-[1px] ${
            v > 0 && h === peakHour ? accentClass : v > 0 ? 'bg-slate-300/80' : 'bg-slate-200/60'
          }`}
          style={{ height: `${Math.max(15, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

function OpsHourlyChip({
  metric,
  highlight,
  onDrill,
}: {
  metric: OpsHourlyMetric;
  highlight?: boolean;
  onDrill?: () => void;
}) {
  const accent = METRIC_ACCENT[metric.id] ?? 'bg-slate-500';
  const clickable = metric.peakCount > 0 && onDrill;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onDrill : undefined}
      className={`flex min-w-[8.5rem] flex-1 flex-col gap-1 rounded-lg border px-2 py-1.5 text-left transition ${
        highlight
          ? 'border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-100'
          : 'border-slate-200/80 bg-white/80'
      } ${clickable ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm' : 'cursor-default'}`}
      title={clickable ? `${metric.description} — 클릭하면 해당 시간대 목록으로 이동` : metric.description}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-medium text-slate-600">{metric.label}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{metric.total}건</span>
      </div>
      <p className="truncate text-[11px] font-semibold tabular-nums text-slate-900 leading-tight">
        {metric.peakCount > 0 ? `${metric.peakLabel} · ${metric.peakCount}건` : '—'}
      </p>
      <MiniHourBars hourly={metric.hourly} peakHour={metric.peakHour} accentClass={accent} />
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

  const primary = data?.metrics.find((m) => m.id === 'order_form_issued');

  const drill = (metricId: OpsHourlyMetricId) => {
    if (!data) return;
    navigate(buildOpsDrillDownUrl(metricId, data));
  };

  return (
    <section className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm shadow-slate-100/50">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="text-fluid-xs font-semibold text-slate-900">운영 시간대 (KST)</h2>
          <HelpTooltip text="테넌트별 최근 기간 동안 이벤트가 몰린 시간대입니다. 메인 지표는 발주서 발급 시각이며, 접수 전환은 RECEIVED 상태 변경 시각, 부재·보류·예약은 부재현황 등록 기준입니다. 칩을 클릭하면 해당 시간대 목록으로 이동합니다." />
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
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
          <span>
            {data.periodStartYmd} ~ {data.periodEndYmd}
          </span>
          {primary && primary.peakCount > 0 ? (
            <span className="font-medium text-indigo-700">발주 발급 피크 {primary.peakLabel}</span>
          ) : null}
          {data.openBacklog.total > 0 ? (
            <span>
              미처리 부재·보류{' '}
              <span className="font-medium tabular-nums text-amber-700">{data.openBacklog.total}건</span>
              <span className="text-slate-400">
                {' '}
                (부재 {data.openBacklog.absent} · 보류 {data.openBacklog.onHold})
              </span>
            </span>
          ) : null}
          {data.conversionByHour.peakRatePct > 0 ? (
            <span>
              예약 전환 피크{' '}
              <span className="font-medium tabular-nums text-emerald-700">
                {data.conversionByHour.peakRatePct}%
              </span>
              <span className="text-slate-400">
                {' '}
                ({data.conversionByHour.peakHour}~
                {data.conversionByHour.peakHour === 23 ? 0 : data.conversionByHour.peakHour + 1}시)
              </span>
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2 text-[11px] text-rose-700">{error}</p>
      ) : loading ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 min-w-[8.5rem] flex-1 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {data.metrics.map((m) => (
              <OpsHourlyChip
                key={m.id}
                metric={m}
                highlight={m.id === 'order_form_issued'}
                onDrill={() => drill(m.id)}
              />
            ))}
          </div>

          {data.heatmap.total > 0 ? (
            <div className="mt-3 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => setHeatmapOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left text-[10px] font-medium text-slate-600 hover:text-slate-900"
              >
                <span>
                  발주 발급 히트맵 (요일×시간)
                  {data.heatmap.peak.count > 0 ? (
                    <span className="ml-1 font-normal text-indigo-600">피크 {data.heatmap.peak.label}</span>
                  ) : null}
                </span>
                <span className="text-slate-400">{heatmapOpen ? '접기' : '펼치기'}</span>
              </button>
              {heatmapOpen ? (
                <div className="mt-2">
                  <OpsHeatmapGrid heatmap={data.heatmap} />
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
