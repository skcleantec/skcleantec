import { emptyHourlyBucket } from './kstHourlyAggregate.js';

/** PG DOW 0=일 … 6=토 × 24시간 */
export type HeatmapGrid = number[][];

export const KST_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function emptyHeatmapGrid(): HeatmapGrid {
  return Array.from({ length: 7 }, () => emptyHourlyBucket());
}

export function applyHeatmapRows(
  grid: HeatmapGrid,
  rows: { dow: number; hour: number; cnt: number }[],
): void {
  for (const row of rows) {
    const d = row.dow;
    const h = row.hour;
    if (d >= 0 && d < 7 && h >= 0 && h < 24) {
      grid[d]![h] = (grid[d]![h] ?? 0) + row.cnt;
    }
  }
}

export function sumHeatmap(grid: HeatmapGrid): number {
  let total = 0;
  for (const row of grid) {
    for (const v of row) total += v ?? 0;
  }
  return total;
}

export function peakFromHeatmap(grid: HeatmapGrid): { dow: number; hour: number; count: number } {
  let dow = 0;
  let hour = 0;
  let count = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = grid[d]?.[h] ?? 0;
      if (v > count) {
        count = v;
        dow = d;
        hour = h;
      }
    }
  }
  return { dow, hour, count };
}

export function heatmapCellLabel(dow: number, hour: number): string {
  const d = Math.max(0, Math.min(6, Math.floor(dow)));
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const next = h === 23 ? 0 : h + 1;
  return `${KST_WEEKDAY_LABELS[d] ?? '?'} ${h}~${next}시`;
}
