import type { TeamMemberItem } from '../api/teams';

export function normalizeCrewMemberNameKey(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, '');
}

/** 메모·검색 문자열과 풀 팀원 이름·nameTh 를 느슨하게 매칭 */
export function findPoolMemberByAlias(
  pool: TeamMemberItem[],
  rawName: string,
): TeamMemberItem | undefined {
  const key = normalizeCrewMemberNameKey(rawName);
  if (!key) return undefined;
  return pool.find((m) => {
    if (normalizeCrewMemberNameKey(m.name) === key) return true;
    const th = (m.nameTh ?? '').trim();
    return th.length > 0 && normalizeCrewMemberNameKey(th) === key;
  });
}

export function crewMemberNamesEquivalent(a: string, b: string): boolean {
  return normalizeCrewMemberNameKey(a) === normalizeCrewMemberNameKey(b);
}

/**
 * 서버가 일자 기준으로 좁힌 풀에 없어도, 이미 폼에 선택된 이름은 드롭다운에 남긴다
 * (TeamMemberSearchSelect · 음영/비활성 로직과 동일하게 현재 값은 유지).
 */
export function mergeCrewPickPoolWithSelections(
  pool: TeamMemberItem[],
  selectedNames: string[],
): TeamMemberItem[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: TeamMemberItem[] = [];

  const markSeen = (m: TeamMemberItem) => {
    seenIds.add(m.id);
    seenKeys.add(normalizeCrewMemberNameKey(m.name));
    const th = (m.nameTh ?? '').trim();
    if (th) seenKeys.add(normalizeCrewMemberNameKey(th));
  };

  const push = (m: TeamMemberItem) => {
    if (seenIds.has(m.id)) return;
    markSeen(m);
    out.push(m);
  };

  for (const m of pool) push(m);

  for (const raw of selectedNames) {
    const name = raw.trim();
    if (!name || seenKeys.has(normalizeCrewMemberNameKey(name))) continue;
    const canonical = findPoolMemberByAlias(pool, name);
    if (canonical) {
      push(canonical);
      continue;
    }
    push({
      id: `__crew-selection:${name}`,
      name,
      phone: null,
      sortOrder: 999_999,
      isActive: true,
      createdAt: '',
      dayOffCount: 0,
    });
  }

  return out;
}
