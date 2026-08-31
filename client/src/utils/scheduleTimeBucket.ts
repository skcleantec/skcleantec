import type { ScheduleItem } from '../api/schedule';
import { isAllDayPreferredTime } from '@shared/scheduleAllDayTime';
import {
  isBetweenSlotPreferredTime,
  isCoordinationPreferredTime,
  isSideCleaningPreferredTime,
} from '@shared/scheduleBetweenSlotTime';

export type ScheduleTimeBucket = 'allday' | 'morning' | 'afternoon' | 'other';

/** 관리 스케줄 일별 구역 순서(종일 → 오전 → 오후 → 기타)와 동일 */
const SCHEDULE_TIME_BUCKET_ORDER: Record<ScheduleTimeBucket, number> = {
  allday: 0,
  morning: 1,
  afternoon: 2,
  other: 3,
};

export type ScheduleTimeBucketSortable = Pick<
  ScheduleItem,
  'preferredTime' | 'betweenScheduleSlot' | 'customerName' | 'id'
>;

export function compareScheduleTimeBucket(a: ScheduleTimeBucketSortable, b: ScheduleTimeBucketSortable): number {
  const byBucket =
    SCHEDULE_TIME_BUCKET_ORDER[getScheduleTimeBucket(a)] -
    SCHEDULE_TIME_BUCKET_ORDER[getScheduleTimeBucket(b)];
  if (byBucket !== 0) return byBucket;
  const byName = (a.customerName ?? '').localeCompare(b.customerName ?? '', 'ko');
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

export function sortInquiriesByScheduleTimeBucket<T extends ScheduleTimeBucketSortable>(items: T[]): T[] {
  return [...items].sort(compareScheduleTimeBucket);
}

export function isSideCleaningTime(t: string | null | undefined): boolean {
  return isSideCleaningPreferredTime(t);
}

export function isCoordinationTime(t: string | null | undefined): boolean {
  return isCoordinationPreferredTime(t);
}

export function isBetweenSlotTime(t: string | null | undefined): boolean {
  return isBetweenSlotPreferredTime(t);
}

/** 서버 `scheduleSlot.helpers` 와 동일 — 목록 구분·팀장 슬롯 필터에 사용 */
export function getScheduleTimeBucket(
  item: Pick<ScheduleItem, 'preferredTime' | 'betweenScheduleSlot'>
): ScheduleTimeBucket {
  const t = item.preferredTime || '';
  const bss =
    item.betweenScheduleSlot && String(item.betweenScheduleSlot).trim() !== ''
      ? String(item.betweenScheduleSlot).trim()
      : null;
  if (isAllDayPreferredTime(t)) return 'allday';
  if (isBetweenSlotPreferredTime(item.preferredTime)) {
    if (bss === '오전') return 'morning';
    if (bss === '오후') return 'afternoon';
    return 'other';
  }
  if (t.includes('오전')) return 'morning';
  if (t.includes('오후')) return 'afternoon';
  if (!t.trim()) return 'other';
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && n < 12) return 'morning';
  return 'afternoon';
}
