import type { DashboardSidoMapBucket } from '../../../api/dashboard';
import {
  JEJU_OUTLINE_PATH,
  KOREA_OUTLINE_PATH,
  KOREA_SIDO_CENTROIDS,
  sidoBubbleRadius,
  sidoMapFillColor,
} from './koreaSidoMap.data';
import type { KoreaSidoKey } from '@shared/regionMatch';
import { KOREA_SIDO_KEYS } from '@shared/regionMatch';

type Props = {
  items: DashboardSidoMapBucket[];
  className?: string;
};

export function DashboardKoreaSidoMap({ items, className = '' }: Props) {
  const byKey = new Map(items.map((i) => [i.sidoKey, i]));
  const max = Math.max(...items.map((i) => i.inquiryCount), 1);
  const total = items.reduce((s, i) => s + i.inquiryCount, 0);

  return (
    <div className={`min-w-0 ${className}`}>
      <svg
        viewBox="0 0 220 260"
        className="w-full h-auto max-h-[220px] mx-auto"
        role="img"
        aria-label="시·도별 접수 분포 지도"
      >
        <path d={KOREA_OUTLINE_PATH} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
        <path d={JEJU_OUTLINE_PATH} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

        {KOREA_SIDO_KEYS.map((sidoKey) => {
          const row = byKey.get(sidoKey);
          const count = row?.inquiryCount ?? 0;
          const c = KOREA_SIDO_CENTROIDS[sidoKey as KoreaSidoKey];
          if (!c || count <= 0) return null;
          const r = sidoBubbleRadius(count, max);
          const fill = sidoMapFillColor(count, max);
          const label = row?.label ?? sidoKey;
          return (
            <g key={sidoKey} className="group/sido">
              <circle
                cx={c.cx}
                cy={c.cy}
                r={r}
                fill={fill}
                fillOpacity={0.88}
                stroke="#fff"
                strokeWidth={1.5}
                className="transition-opacity group-hover/sido:opacity-100"
              />
              <text
                x={c.cx}
                y={c.cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-900 text-[8px] font-semibold pointer-events-none select-none"
                style={{ fontSize: r >= 14 ? 9 : 7 }}
              >
                {label}
              </text>
              <title>{`${label} · ${count.toLocaleString('ko-KR')}건`}</title>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>총 {total.toLocaleString('ko-KR')}건 · 접수 주소 기준 시·도</span>
        <div className="flex items-center gap-1">
          <span>적음</span>
          <div className="flex h-2 w-20 overflow-hidden rounded-full">
            {['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4338ca'].map((c) => (
              <div key={c} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span>많음</span>
        </div>
      </div>
    </div>
  );
}
