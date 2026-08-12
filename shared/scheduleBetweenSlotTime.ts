/**
 * 사이청소·조율 — 발주서 시간대 옵션으로만 존재.
 * 오전·오후와 별도 용량이 아니라 `betweenScheduleSlot` 확정 시 해당 슬롯 1건 소모.
 */

export const BETWEEN_SLOT_SIDE_VALUE = '사이청소' as const;
export const BETWEEN_SLOT_COORDINATION_VALUE = '조율' as const;

export const BETWEEN_SLOT_PREFERRED_TIME_VALUES = [
  BETWEEN_SLOT_SIDE_VALUE,
  BETWEEN_SLOT_COORDINATION_VALUE,
] as const;

export type BetweenSlotPreferredTime = (typeof BETWEEN_SLOT_PREFERRED_TIME_VALUES)[number];

export type BetweenSlotKind = 'side' | 'coordination';

export function isSideCleaningPreferredTime(t: string | null | undefined): boolean {
  return (t || '').includes(BETWEEN_SLOT_SIDE_VALUE);
}

export function isCoordinationPreferredTime(t: string | null | undefined): boolean {
  return (t || '').includes(BETWEEN_SLOT_COORDINATION_VALUE);
}

export function isBetweenSlotPreferredTime(t: string | null | undefined): boolean {
  return isSideCleaningPreferredTime(t) || isCoordinationPreferredTime(t);
}

export function betweenSlotKind(t: string | null | undefined): BetweenSlotKind | null {
  if (isCoordinationPreferredTime(t)) return 'coordination';
  if (isSideCleaningPreferredTime(t)) return 'side';
  return null;
}

/** 오전·오후 확정 여부 — 확정 시 해당 슬롯 1건 소모, ⚡ 배지는 표시하지 않음 */
export function isBetweenScheduleSlotConfirmed(betweenScheduleSlot: string | null | undefined): boolean {
  const s = String(betweenScheduleSlot ?? '').trim();
  return s === '오전' || s === '오후';
}

/** @deprecated isBetweenScheduleSlotConfirmed 사용 */
export const isSideCleaningScheduleSlotConfirmed = isBetweenScheduleSlotConfirmed;

export function countsForBetweenSlotCalendarBadge(
  inv: {
    preferredTime: string | null;
    betweenScheduleSlot?: string | null;
    assignments: ReadonlyArray<unknown>;
  },
  kind: BetweenSlotKind,
): boolean {
  const slotKind = betweenSlotKind(inv.preferredTime);
  if (slotKind !== kind) return false;
  if (inv.assignments.length > 0) return false;
  if (isBetweenScheduleSlotConfirmed(inv.betweenScheduleSlot)) return false;
  return true;
}

/** 사이청소만 — 캘린더 ⚡ 사이 배지 */
export function countsForSideCleaningCalendarBadge(inv: {
  preferredTime: string | null;
  betweenScheduleSlot?: string | null;
  assignments: ReadonlyArray<unknown>;
}): boolean {
  return countsForBetweenSlotCalendarBadge(inv, 'side');
}

/** 조율만 — 캘린더 조율 배지(깜빡임) */
export function countsForCoordinationCalendarBadge(inv: {
  preferredTime: string | null;
  betweenScheduleSlot?: string | null;
  assignments: ReadonlyArray<unknown>;
}): boolean {
  return countsForBetweenSlotCalendarBadge(inv, 'coordination');
}
