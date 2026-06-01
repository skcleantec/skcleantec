/** 팀장 사원증 UI용 — 계정별로 고정된 시드로 3~4개 직함을 뽑습니다(다른 팀장과 다르게). */

export type StaffHonorific = {
  emoji: string;
  titleKo: string;
  titleEn: string;
};

const POOL: readonly StaffHonorific[] = [
  { emoji: '⚜️', titleKo: '홈 디테일링 엑스퍼트', titleEn: 'Home Detailing Expert' },
  { emoji: '💎', titleKo: '공간 케어 스페셜리스트', titleEn: 'Space Care Specialist' },
  { emoji: '✨', titleKo: '실내 환경 관리사', titleEn: 'Indoor Environment Manager' },
  { emoji: '👑', titleKo: '프리미엄 클리닝 프로페셔널', titleEn: 'Premium Cleaning Professional' },
  { emoji: '🌟', titleKo: '프라이빗 홈 디렉터', titleEn: 'Private Home Director' },
  { emoji: '🏵️', titleKo: 'VIP 스페이스 매니저', titleEn: 'VIP Space Manager' },
  { emoji: '💠', titleKo: '에코 클리닝 코디네이터', titleEn: 'Eco-Cleaning Coordinator' },
  { emoji: '🎖️', titleKo: '하우스 디톡스 플래너', titleEn: 'House Detox Planner' },
  { emoji: '🏆', titleKo: '현장 품질 관리 매니저', titleEn: 'Quality Control Manager' },
  { emoji: '🥇', titleKo: '치프 홈 테크니션', titleEn: 'Chief Home Technician' },
] as const;

function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 다음 의사난수 (0 이상 1 미만) — 시드 갱신 */
function nextRand(seedRef: { v: number }): number {
  seedRef.v = (Math.imul(seedRef.v, 1664525) + 1013904223) >>> 0;
  return (seedRef.v >>> 0) / 0x100000000;
}

/**
 * UUID 등 사용자 ID 기준으로 항상 같은 조합이 나오고, 팀장마다 다른 직함 세트가 되도록 선택합니다.
 */
export function pickStaffHonorificsForUserId(userId: string | null | undefined): StaffHonorific[] {
  const id = userId?.trim();
  if (!id) return [];

  const seed = fnv1a32(`skct:honor:${id}`) || 1;
  const seedRef = { v: seed };

  const count = 3 + (nextRand(seedRef) < 0.42 ? 1 : 0);

  const order = POOL.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(seedRef) * (i + 1));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }

  return order.slice(0, count).map((idx) => POOL[idx]!);
}
