import { addDaysToKstYmd, kstTodayYmd } from './dateFormat';

function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 약 2년 ~ 3년 전 KST 달력의 임의 하루 (팀장 계정 시드로 고정, 입사일 미등록 시 UI용) */
export function pickSyntheticHireYmdForUserId(userId: string | null | undefined): string {
  const id = userId?.trim() || 'viewer';
  const seed = fnv1a32(`skct:synthhire:${id}`) || 1;
  const minDaysAgo = 730; // ~2년
  const maxDaysAgo = 1095; // ~3년
  const span = maxDaysAgo - minDaysAgo + 1;
  const daysAgo = minDaysAgo + (seed % span);
  return addDaysToKstYmd(kstTodayYmd(), -daysAgo);
}
