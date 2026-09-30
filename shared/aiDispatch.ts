/** AI 미리 배정 — 클라이언트·문서 공통. 서버 상수는 aiDispatch.constants.ts 와 맞춘다. */

export const AI_DISPATCH_SLOTS = ['AM', 'PM', 'ALL_DAY', 'HUMAN'] as const;
export type AiDispatchSlot = (typeof AI_DISPATCH_SLOTS)[number];

export const AI_DISPATCH_FATIGUE_BANDS = ['좋음', '보통', '피로'] as const;
export type AiDispatchFatigueBand = (typeof AI_DISPATCH_FATIGUE_BANDS)[number];

export const AI_DISPATCH_DEFAULTS = {
  extraLeaderMinPyeong: 40,
  extraLeaderCount: 2,
  twoRoomMaxPyeong: 15,
} as const;

export function aiDispatchSlotLabel(slot: string): string {
  if (slot === 'AM') return '오전';
  if (slot === 'PM') return '오후';
  if (slot === 'ALL_DAY') return '종일';
  return '사람 판단';
}
