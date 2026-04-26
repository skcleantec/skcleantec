import type { TeamMemberItem } from '../api/teams';

/**
 * 서버가 일자 기준으로 좁힌 풀에 없어도, 이미 폼에 선택된 이름은 드롭다운에 남긴다
 * (TeamMemberSearchSelect · 음영/비활성 로직과 동일하게 현재 값은 유지).
 */
export function mergeCrewPickPoolWithSelections(
  pool: TeamMemberItem[],
  selectedNames: string[]
): TeamMemberItem[] {
  const seen = new Set(pool.map((m) => m.name));
  const extras: TeamMemberItem[] = [];
  for (const raw of selectedNames) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    extras.push({
      id: `__crew-selection:${name}`,
      name,
      phone: null,
      sortOrder: 999_999,
      isActive: true,
      createdAt: '',
      dayOffCount: 0,
    });
  }
  return [...pool, ...extras];
}
