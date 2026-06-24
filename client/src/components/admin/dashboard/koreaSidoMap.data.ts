/**
 * 시·도 choropleth 색상·범례 — path는 koreaSidoPaths.ts (@svg-maps/south-korea, CC BY 4.0).
 */

/** choropleth용 red 농도 (적음 → 많음) */
export function sidoMapFillColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return '#f1f5f9';
  const t = count / max;
  if (t >= 0.85) return '#b91c1c';
  if (t >= 0.65) return '#dc2626';
  if (t >= 0.45) return '#ef4444';
  if (t >= 0.25) return '#f87171';
  if (t >= 0.1) return '#fca5a5';
  return '#fecaca';
}

export const SIDO_MAP_LEGEND_COLORS = [
  '#fecaca',
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#dc2626',
] as const;
