import type { ScheduleItem } from '../api/schedule';
import { inquiryExcludedFromInternalToByDbListing } from '@shared/dbMarketplaceSchedule';
import { isSideCleaningTime } from './scheduleTimeBucket';

/** server `scheduleSlot.helpers` 와 동일 — 슬롯 점유·팀장 드롭다운 필터 */
function isPlainPreferredTimeUnset(preferredTime: string | null | undefined): boolean {
  return !String(preferredTime ?? '').trim();
}

function isPlainMorningSlot(t: string | null | undefined): boolean {
  const s = t || '';
  if (s.includes('사이청소')) return false;
  if (s.includes('오전')) return true;
  if (s.includes('오후')) return false;
  const n = parseInt(s, 10);
  return !Number.isNaN(n) && n < 12;
}

export function consumesMorningSlot(item: Pick<ScheduleItem, 'preferredTime' | 'betweenScheduleSlot'>): boolean {
  if (isSideCleaningTime(item.preferredTime)) {
    return item.betweenScheduleSlot === '오전';
  }
  if (isPlainPreferredTimeUnset(item.preferredTime)) return false;
  return isPlainMorningSlot(item.preferredTime);
}

export function consumesAfternoonSlot(item: Pick<ScheduleItem, 'preferredTime' | 'betweenScheduleSlot'>): boolean {
  if (isSideCleaningTime(item.preferredTime)) {
    return item.betweenScheduleSlot === '오후';
  }
  if (isPlainPreferredTimeUnset(item.preferredTime)) return false;
  return !isPlainMorningSlot(item.preferredTime);
}

function inquiryUsesInternalTeamLeaderSlot(item: ScheduleItem): boolean {  const list = item.assignments ?? [];
  if (list.length === 0) return true;
  return list.some((a) => a.teamLeader.role === 'TEAM_LEADER' || a.teamLeader.role === 'ADMIN');
}

/** 캘린더 TO·슬롯 점유 — 파트너 연계(송신·ACTIVE)·정보공유(장바구니~확정)는 자사 용량에서 제외 */
export function inquiryCountsForInternalToSlot(item: ScheduleItem): boolean {
  if (item.tenantShare?.role === 'SOURCE' && item.tenantShare?.syncStatus === 'ACTIVE') return false;
  if (inquiryExcludedFromInternalToByDbListing(item.dbListing)) return false;
  return inquiryUsesInternalTeamLeaderSlot(item);
}

function internalLeaderIds(item: ScheduleItem): string[] {
  return (item.assignments ?? [])
    .filter((a) => a.teamLeader.role === 'TEAM_LEADER' || a.teamLeader.role === 'ADMIN')
    .map((a) => a.teamLeader.id)
    .filter(Boolean);
}

/** 해당 예약일 접수 중 슬롯별로 이미 배정된 자사 팀장 id (편집 중인 접수는 제외) */
export function buildSlotOccupiedLeaderIdsForDay(
  items: ScheduleItem[],
  excludeInquiryId?: string,
): { morning: Set<string>; afternoon: Set<string> } {
  const morning = new Set<string>();
  const afternoon = new Set<string>();
  for (const inv of items) {
    if (excludeInquiryId && inv.id === excludeInquiryId) continue;
    if (!inquiryCountsForInternalToSlot(inv)) continue;
    const ids = internalLeaderIds(inv);
    if (ids.length === 0) continue;
    if (consumesMorningSlot(inv)) ids.forEach((id) => morning.add(id));
    if (consumesAfternoonSlot(inv)) ids.forEach((id) => afternoon.add(id));
  }
  return { morning, afternoon };
}
