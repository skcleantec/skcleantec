/**
 * 시·도 지도 SVG — viewBox 0 0 220 260, centroid·윤곽(단순화).
 * `sidoKey`는 shared/regionMatch `KOREA_SIDO_KEYS` 와 동일.
 */

import type { KoreaSidoKey } from '@shared/regionMatch';

export type SidoMapCentroid = { cx: number; cy: number };

/** 한반도+제주 단순 윤곽 (배경) */
export const KOREA_OUTLINE_PATH =
  'M52 38 L118 32 L162 52 L172 88 L168 128 L148 162 L118 178 L82 172 L58 148 L48 118 L44 82 L48 58 Z';

export const JEJU_OUTLINE_PATH = 'M68 228 A14 10 0 1 1 82 228 A14 10 0 1 1 68 228 Z';

export const KOREA_SIDO_CENTROIDS: Record<KoreaSidoKey, SidoMapCentroid> = {
  서울특별시: { cx: 102, cy: 78 },
  경기도: { cx: 88, cy: 72 },
  인천광역시: { cx: 72, cy: 76 },
  강원특별자치도: { cx: 128, cy: 58 },
  충청북도: { cx: 98, cy: 98 },
  세종특별자치시: { cx: 92, cy: 108 },
  충청남도: { cx: 82, cy: 118 },
  대전광역시: { cx: 94, cy: 122 },
  경상북도: { cx: 132, cy: 108 },
  대구광역시: { cx: 128, cy: 132 },
  울산광역시: { cx: 148, cy: 138 },
  경상남도: { cx: 112, cy: 142 },
  부산광역시: { cx: 142, cy: 152 },
  전북특별자치도: { cx: 78, cy: 132 },
  광주광역시: { cx: 76, cy: 148 },
  전라남도: { cx: 68, cy: 158 },
  제주특별자치도: { cx: 75, cy: 228 },
};

/** choropleth용 indigo 농도 (Tailwind indigo 계열) */
export function sidoMapFillColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#e2e8f0';
  const t = count / max;
  if (t >= 0.85) return '#4338ca';
  if (t >= 0.65) return '#4f46e5';
  if (t >= 0.45) return '#6366f1';
  if (t >= 0.25) return '#818cf8';
  if (t >= 0.1) return '#a5b4fc';
  return '#c7d2fe';
}

export function sidoBubbleRadius(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const t = Math.sqrt(count / max);
  return Math.max(6, Math.round(6 + t * 18));
}
