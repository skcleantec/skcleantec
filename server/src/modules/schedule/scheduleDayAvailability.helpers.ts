/** 일자별 팀장/팀원 가용 — 휴무일 + 관리자 수동 슬롯 병합 */

export function resolveLeaderMorningAfternoon(
  hasUserDayOff: boolean,
  override?: { morningAvailable: boolean; afternoonAvailable: boolean } | null
): { morning: boolean; afternoon: boolean } {
  if (override) {
    return { morning: override.morningAvailable, afternoon: override.afternoonAvailable };
  }
  const base = !hasUserDayOff;
  return { morning: base, afternoon: base };
}

export function resolveMemberAvailable(
  hasTeamMemberDayOff: boolean,
  overrideAvailable?: boolean | null
): boolean {
  if (overrideAvailable != null) return overrideAvailable;
  return !hasTeamMemberDayOff;
}
