import type { ScheduleItem } from '../api/schedule';

type CacheEntry = { items: ScheduleItem[]; at: number };

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function scheduleMonthCacheKey(start: string, end: string): string {
  return `${start}:${end}`;
}

export function readScheduleMonthCache(start: string, end: string): ScheduleItem[] | null {
  const entry = cache.get(scheduleMonthCacheKey(start, end));
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(scheduleMonthCacheKey(start, end));
    return null;
  }
  return entry.items;
}

export function writeScheduleMonthCache(start: string, end: string, items: ScheduleItem[]): void {
  cache.set(scheduleMonthCacheKey(start, end), { items, at: Date.now() });
}
