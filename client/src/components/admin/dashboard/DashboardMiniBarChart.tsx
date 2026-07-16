export type DashboardChartItem = {
  key: string;
  label: string;
  value: number;
  subLabel?: string;
};

export function DashboardVerticalBarChart({
  items,
  accentClass = 'bg-indigo-500',
  peakAccentClass,
  formatValue,
  barAreaClass = 'h-28',
  showValueLabels = false,
  labelEvery = 1,
  dense = false,
  onBarClick,
  ariaLabel,
}: {
  items: DashboardChartItem[];
  accentClass?: string;
  peakAccentClass?: string;
  formatValue?: (n: number) => string;
  barAreaClass?: string;
  showValueLabels?: boolean;
  labelEvery?: number;
  /** 좁은 영역용 — 막대·간격·라벨을 더 작게 */
  dense?: boolean;
  onBarClick?: (item: DashboardChartItem) => void;
  ariaLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const peak = items.reduce((best, cur) => (cur.value > best.value ? cur : best), items[0] ?? { key: '', label: '', value: 0 });
  const fmt = formatValue ?? ((n: number) => String(n));

  const gapClass = dense ? 'gap-0.5' : 'gap-1 sm:gap-1.5';
  const barWidthClass = dense ? 'w-full max-w-2.5 mx-auto' : 'w-full';
  const labelClass = dense ? 'mt-0.5 text-[8px]' : 'mt-1 text-[9px]';
  const labelSpacerClass = dense ? 'mt-0.5 h-[11px]' : 'mt-1 h-[13px]';

  return (
    <div className="w-full min-w-0" role="img" aria-label={ariaLabel}>
      <div className={`relative flex w-full items-end ${gapClass} ${barAreaClass}`}>
        {items.map((item, idx) => {
          const heightPct = item.value > 0 ? Math.max(12, Math.round((item.value / max) * 100)) : 8;
          const isPeak = item.value > 0 && item.key === peak.key;
          const accent = isPeak ? (peakAccentClass ?? accentClass) : accentClass;
          const clickable = onBarClick != null;
          return (
            <div
              key={item.key}
              className="group/bar relative flex min-w-0 flex-1 h-full flex-col items-center justify-end"
            >
              {showValueLabels && item.value > 0 ? (
                <span
                  className={`mb-0.5 text-[9px] font-semibold leading-none tabular-nums ${
                    isPeak ? 'text-slate-800' : 'text-slate-500'
                  }`}
                >
                  {fmt(item.value)}
                </span>
              ) : null}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onBarClick?.(item)}
                title={item.subLabel ?? `${item.label} · ${fmt(item.value)}`}
                className={`${barWidthClass} rounded-t-md transition-all min-h-[4px] ${
                  item.value > 0 ? `${accent} opacity-90 group-hover/bar:opacity-100 shadow-sm` : 'bg-slate-200/60'
                } ${clickable && item.value > 0 ? 'cursor-pointer hover:ring-1 hover:ring-slate-400/50' : 'cursor-default'}`}
                style={{ height: `${heightPct}%` }}
              />
              <div
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm group-hover/bar:block"
                aria-hidden
              >
                {item.subLabel ?? `${item.label} · ${fmt(item.value)}`}
              </div>
              {labelEvery > 0 && (idx % labelEvery === 0 || idx === items.length - 1) ? (
                <span className={`${labelClass} font-medium text-slate-500 whitespace-nowrap tabular-nums`}>
                  {item.label}
                </span>
              ) : (
                <span className={labelSpacerClass} aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardHorizontalBarChart({
  items,
  accentClass = 'bg-violet-500',
  formatValue,
  onBarClick,
  ariaLabel,
}: {
  items: DashboardChartItem[];
  accentClass?: string;
  formatValue?: (n: number) => string;
  onBarClick?: (item: DashboardChartItem) => void;
  ariaLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const fmt = formatValue ?? ((n: number) => String(n));

  return (
    <ul className="space-y-2 min-w-0" role="img" aria-label={ariaLabel}>
      {items.map((item) => {
        const widthPct = item.value > 0 ? Math.max(8, Math.round((item.value / max) * 100)) : 0;
        const clickable = onBarClick != null && item.value > 0;
        return (
          <li key={item.key} className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-fluid-2xs font-medium text-slate-800 truncate" title={item.label}>
                {item.label}
              </span>
              <span className="text-fluid-2xs font-bold tabular-nums text-slate-900 shrink-0">
                {fmt(item.value)}
              </span>
            </div>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onBarClick?.(item)}
              title={item.subLabel ?? `${item.label} · ${fmt(item.value)}`}
              className={`relative h-2 w-full rounded-full bg-slate-100 overflow-hidden ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${accentClass}`}
                style={{ width: `${widthPct}%` }}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
