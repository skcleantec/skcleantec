/** shared/aiDispatch.ts 와 기본값을 맞춘다. 서버 tsconfig rootDir 때문에 shared 를 직접 import 하지 않는다. */

export const AI_DISPATCH_DEFAULTS = {
  extraLeaderMinPyeong: 40,
  extraLeaderCount: 2,
  twoRoomMaxPyeong: 15,
} as const;

export type AiDispatchSlot = 'AM' | 'PM' | 'ALL_DAY' | 'HUMAN';
export type AiDispatchFatigueBand = '좋음' | '보통' | '피로';
