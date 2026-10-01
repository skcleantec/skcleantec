/** shared/aiDispatch.ts 와 기본값을 맞춘다. 서버 tsconfig rootDir 때문에 shared 를 직접 import 하지 않는다. */

export const AI_DISPATCH_DEFAULTS = {
  extraLeaderMinPyeong: 40,
  extraLeaderCount: 2,
  twoRoomMaxPyeong: 15,
  /** shared/aiDispatch.ts 와 동일. 팀원 없는 날에 점수를 더할지. */
  includeCrewInFatigue: false,
  /** shared/aiDispatch.ts 와 동일. 휴무 다음 이 근무일을 넘기면 점수가 더 오른다. */
  normalWorkDaysPerWeek: 6,
  normalJobsPerWeek: 12,
} as const;

export type AiDispatchSlot = 'AM' | 'PM' | 'ALL_DAY' | 'HUMAN';
export type AiDispatchFatigueBand = '좋음' | '보통' | '피로' | '매우피로';
