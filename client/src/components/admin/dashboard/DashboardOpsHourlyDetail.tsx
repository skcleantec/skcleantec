import { Fragment } from 'react';
import type { OpsHeatmap, OpsHourlyMetric, OpsHourlySummary } from '../../../api/dashboard';

const METRIC_ACCENT: Record<string, string> = {
  order_form_issued: 'bg-indigo-500',
  order_form_submitted: 'bg-sky-500',
  inquiry_received: 'bg-violet-500',
  followup_absent: 'bg-amber-500',
  followup_on_hold: 'bg-orange-400',
  followup_reserved: 'bg-emerald-500',
};

function formatHourRange(h: number): string {
  const hour = Math.max(0, Math.min(23, Math.floor(h)));
  const next = hour === 23 ? 0 : hour + 1;
  return `${hour}~${next}시`;
}

function HourlyBarChart({
  hourly,
  peakHour,
  accentClass,
}: {
  hourly: number[];
  peakHour: number;
  accentClass: string;
}) {
  const max = Math.max(...hourly, 1);
  return (
    <div className="w-full" role="img" aria-label="0~23시(KST) 시간대별 건수 막대">
      <div className="flex w-full items-end gap-px h-20">
        {hourly.map((v, h) => {
          const heightPct = v > 0 ? Math.max(12, Math.round((v / max) * 100)) : 8;
          const isPeak = v > 0 && h === peakHour;
          return (
            <div key={h} className="group/bar relative flex min-w-0 flex-1 h-full flex-col items-center justify-end">
              {v > 0 ? (
                <span className={`mb-0.5 text-[9px] font-semibold leading-none tabular-nums ${isPeak ? 'text-slate-800' : 'text-slate-500'}`}>
                  {v}
                </span>
              ) : null}
              <div
                title={`${formatHourRange(h)} · ${v}건`}
                className={`w-full rounded-[2px] ${v > 0 ? (isPeak ? accentClass : 'bg-slate-300/90') : 'bg-slate-200/60'} opacity-90`}
                style={{ height: `${heightPct}%`, minHeight: v > 0 ? '4px' : '2px' }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex w-full gap-px">
        {hourly.map((_, h) => (
          <div key={h} className="min-w-0 flex-1 text-center text-[8px] leading-none tabular-nums text-slate-400">
            {h % 3 === 0 ? h : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: OpsHourlyMetric }) {
  const accent = METRIC_ACCENT[metric.id] ?? 'bg-slate-500';
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-fluid-2xs font-semibold text-slate-800">{metric.label}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">{metric.description}</p>
        </div>
        <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">
          {metric.total}건
        </span>
      </div>
      <p className="mt-2 text-sm font-bold tabular-nums text-indigo-700">
        {metric.peakCount > 0 ? `${metric.peakLabel} · ${metric.peakCount}건` : '피크 없음'}
      </p>
      <div className="mt-2">
        <HourlyBarChart hourly={metric.hourly} peakHour={metric.peakHour} accentClass={accent} />
      </div>
    </div>
  );
}

function HeatmapGrid({ heatmap }: { heatmap: OpsHeatmap }) {
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
                  className={`aspect-square min-h-[0.65rem] rounded-[1px] ${isPeak ? 'ring-1 ring-indigo-400' : ''}`}
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

export function DashboardOpsHourlyDetail({ data }: { data: OpsHourlySummary }) {
  return (
    <div className="space-y-4">
      <p className="text-fluid-2xs text-slate-500">
        {data.periodStartYmd} ~ {data.periodEndYmd} ({data.periodDays}일)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.metrics.map((m) => (
          <MetricCard key={m.id} metric={m} />
        ))}
      </div>
      {data.heatmap.total > 0 ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
          <p className="text-fluid-2xs font-semibold text-indigo-900 mb-2">
            발주 발급 · 요일×시간 히트맵
            {data.heatmap.peak.count > 0 ? (
              <span className="ml-1 font-normal text-indigo-700">피크 {data.heatmap.peak.label}</span>
            ) : null}
          </p>
          <HeatmapGrid heatmap={data.heatmap} />
        </div>
      ) : null}
    </div>
  );
}
