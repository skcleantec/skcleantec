import type { ScheduleItem } from '../api/schedule';

export type ScheduleTimeBucket = 'morning' | 'afternoon' | 'other';

export function isSideCleaningTime(t: string | null | undefined): boolean {
  return (t || '').includes('사이청소');
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
  if (isSideCleaningTime(item.preferredTime)) {
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
