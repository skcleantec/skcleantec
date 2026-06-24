import type { DashboardSidoMapBucket } from '../../../api/dashboard';
import {
  SIDO_MAP_LEGEND_COLORS,
  sidoMapFillColor,
} from './koreaSidoMap.data';
import { KOREA_SIDO_MAP_VIEWBOX, KOREA_SIDO_PATHS } from './koreaSidoPaths';
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
        viewBox={KOREA_SIDO_MAP_VIEWBOX}
        className="w-full h-auto max-h-[240px] mx-auto"
        role="img"
        aria-label="시·도별 접수 분포 지도"
      >
        {KOREA_SIDO_KEYS.map((sidoKey) => {
          const path = KOREA_SIDO_PATHS[sidoKey];
          const row = byKey.get(sidoKey);
          const count = row?.inquiryCount ?? 0;
          const fill = sidoMapFillColor(count, max);
          const label = row?.label ?? sidoKey;
          return (
            <path
              key={sidoKey}
              d={path.d}
              fill={fill}
              stroke="#fff"
              strokeWidth={0.8}
              className="transition-colors duration-150 hover:brightness-95"
            >
              <title>{`${label} · ${count.toLocaleString('ko-KR')}건`}</title>
            </path>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>총 {total.toLocaleString('ko-KR')}건 · 접수 주소 기준 시·도</span>
        <div className="flex items-center gap-1">
          <span>적음</span>
          <div className="flex h-2 w-20 overflow-hidden rounded-full">
            {SIDO_MAP_LEGEND_COLORS.map((c) => (
              <div key={c} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span>많음</span>
        </div>
      </div>
    </div>
  );
}
