import type { UserItem } from '../api/users';

/** 팀원 배정 간격 표시용: 선택된 슬롯 중 첫 **자사** 팀장(타업체 제외). */
export function resolveTeamLeaderIdForCrewSpacing(
  teamLeaderIds: string[],
  leaders: Pick<UserItem, 'id' | 'role'>[]
): string | null {
  for (const raw of teamLeaderIds) {
    const id = raw.trim();
    if (!id) continue;
    const u = leaders.find((l) => l.id === id);
    if (!u) continue;
    if (u.role === 'EXTERNAL_PARTNER') continue;
    return u.id;
  }
  return null;
}
