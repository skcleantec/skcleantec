/** KST 0~23시 버킷 — 길이 24, 인덱스 = 시 */

export type HourlyBucket = number[];

export function emptyHourlyBucket(): HourlyBucket {
  return new Array<number>(24).fill(0);
}

export function peakFromHourly(hourly: HourlyBucket): { hour: number; count: number } {
  let hour = 0;
  let count = 0;
  for (let h = 0; h < 24; h++) {
    const v = hourly[h] ?? 0;
    if (v > count) {
      count = v;
      hour = h;
    }
  }
  return { hour, count };
}

export function sumHourly(hourly: HourlyBucket): number {
  return hourly.reduce((a, b) => a + b, 0);
}

export function applyHourlyRows(hourly: HourlyBucket, rows: { hour: number; cnt: number }[]): void {
  for (const row of rows) {
    const h = row.hour;
    if (h >= 0 && h < 24) hourly[h] = (hourly[h] ?? 0) + row.cnt;
  }
}

export function formatKstHourLabel(hour: number): string {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  return `${h}시`;
}

export function formatKstHourRangeLabel(hour: number): string {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const next = h === 23 ? 0 : h + 1;
  return `${h}~${next}시`;
}
