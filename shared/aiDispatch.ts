/** AI 미리 배정 — 클라이언트·문서 공통. 서버 상수는 aiDispatch.constants.ts 와 맞춘다. */

export const AI_DISPATCH_SLOTS = ['AM', 'PM', 'ALL_DAY', 'HUMAN'] as const;
export type AiDispatchSlot = (typeof AI_DISPATCH_SLOTS)[number];

export const AI_DISPATCH_FATIGUE_BANDS = ['좋음', '보통', '피로', '매우피로'] as const;
export type AiDispatchFatigueBand = (typeof AI_DISPATCH_FATIGUE_BANDS)[number];

export const AI_DISPATCH_DEFAULTS = {
  extraLeaderMinPyeong: 40,
  extraLeaderCount: 2,
  twoRoomMaxPyeong: 15,
  /** 팀원 없이 간 날에 피로 점수를 더할지. 팀원을 안 쓰는 업체는 끔. */
  includeCrewInFatigue: false,
  /** 휴무 다음 이 근무일을 넘기면 피로가 더 오른다. 휴무가 없으면 2주 기준으로 매우 나쁨이다. */
  normalWorkDaysPerWeek: 6,
  normalJobsPerWeek: 12,
} as const;

export function aiDispatchSlotLabel(slot: string): string {
  if (slot === 'AM') return '오전';
  if (slot === 'PM') return '오후';
  if (slot === 'ALL_DAY') return '종일';
  return '사람 판단';
}
