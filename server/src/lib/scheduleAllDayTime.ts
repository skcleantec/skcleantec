/**
 * @generated-sync from shared/scheduleAllDayTime.ts — 직접 수정하지 마세요.
 */
/**
 * 종일 — 마케터·관리자만 접수 수정에서 선택.
 * 하루 한 건, 오전·오후 TO 슬롯 모두 소모. 발주서 공개 옵션에는 포함하지 않음.
 */

export const ALL_DAY_PREFERRED_TIME_VALUE = '종일' as const;

export type AllDayPreferredTime = typeof ALL_DAY_PREFERRED_TIME_VALUE;

export function isAllDayPreferredTime(t: string | null | undefined): boolean {
  return String(t ?? '').trim() === ALL_DAY_PREFERRED_TIME_VALUE;
}

/** 종일 접수는 오전·오후 슬롯을 각각 1건(× slotWeight) 소모 */
export function consumesBothScheduleSlots(t: string | null | undefined): boolean {
  return isAllDayPreferredTime(t);
}
