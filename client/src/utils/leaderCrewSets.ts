import { parseCrewMemberNoteToNames } from './crewMemberNote';

/** 담당 팀장 + 단독 + 팀원 N명 — 한 세트 */
export type LeaderCrewSet = {
  teamLeaderId: string;
  solo: boolean;
  crewMemberCount: number;
  crewMemberNames: string[];
};

export function defaultLeaderCrewSet(): LeaderCrewSet {
  return { teamLeaderId: '', solo: false, crewMemberCount: 0, crewMemberNames: [] };
}

export function resizeLeaderCrewSetNames(set: LeaderCrewSet, count: number): LeaderCrewSet {
  const nextCount = Math.max(0, Math.min(100, Math.floor(count)));
  const nextNames = [...set.crewMemberNames];
  if (nextNames.length > nextCount) nextNames.length = nextCount;
  while (nextNames.length < nextCount) nextNames.push('');
  return { ...set, crewMemberCount: nextCount, crewMemberNames: nextNames };
}

export function initLeaderCrewSetsFromInquiry(params: {
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
  crewMemberNote?: string | null;
  crewMemberCount?: number | null;
  crewLeaderAssignments?: Array<{ crewMemberName: string; teamLeaderId: string; sortOrder?: number | null }>;
}): LeaderCrewSet[] {
  const leaders = params.teamLeaderIds.length > 0 ? [...params.teamLeaderIds] : [''];
  const soloSet = new Set(params.soloTeamLeaderIds);
  const allNames = parseCrewMemberNoteToNames(params.crewMemberNote);
  const assignments = [...(params.crewLeaderAssignments ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const byName = new Map(assignments.map((a) => [a.crewMemberName, a.teamLeaderId] as const));
  const trimmedLeaders = leaders.map((id) => id.trim()).filter(Boolean);
  const nonSoloLeaders = trimmedLeaders.filter((id) => !soloSet.has(id));
  const totalCount = params.crewMemberCount ?? 0;

  const namesByLeader = new Map<string, string[]>();

  /** 저장 시 note 순서 ↔ sortOrder 가 1:1 — 이름 키보다 우선(동명·표기 차이 방지) */
  if (assignments.length > 0 && assignments.length === allNames.length) {
    for (let i = 0; i < allNames.length; i++) {
      const name = allNames[i]!;
      const row = assignments[i]!;
      let lid = row.teamLeaderId?.trim() ?? '';
      if (!lid || !trimmedLeaders.includes(lid) || soloSet.has(lid)) continue;
      const arr = namesByLeader.get(lid) ?? [];
      arr.push(name);
      namesByLeader.set(lid, arr);
    }
  } else {
    for (const name of allNames) {
      let lid = byName.get(name)?.trim();
      if (!lid || !trimmedLeaders.includes(lid)) {
        lid = undefined;
      }
      if (!lid) {
        lid = nonSoloLeaders[0] ?? trimmedLeaders[0] ?? '';
      }
      if (!lid || soloSet.has(lid)) continue;
      const arr = namesByLeader.get(lid) ?? [];
      arr.push(name);
      namesByLeader.set(lid, arr);
    }
  }

  return leaders.map((teamLeaderId) => {
    const lid = teamLeaderId.trim();
    if (!lid) return defaultLeaderCrewSet();
    if (soloSet.has(lid)) {
      return { teamLeaderId, solo: true, crewMemberCount: 0, crewMemberNames: [] };
    }
    const names = namesByLeader.get(lid) ?? [];
    let count = names.length;
    if (nonSoloLeaders.length === 1 && nonSoloLeaders[0] === lid) {
      count = Math.max(count, totalCount);
    }
    const crewMemberNames = [...names];
    while (crewMemberNames.length < count) crewMemberNames.push('');
    return { teamLeaderId, solo: false, crewMemberCount: count, crewMemberNames };
  });
}

export function syncFlatFromLeaderCrewSets(sets: LeaderCrewSet[]): {
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
  crewMemberCount: number;
  crewMemberNames: string[];
  crewMemberLeaderIds: string[];
} {
  const teamLeaderIds = sets.map((s) => s.teamLeaderId);
  const soloTeamLeaderIds = sets
    .filter((s) => s.solo && s.teamLeaderId.trim())
    .map((s) => s.teamLeaderId.trim());

  let crewMemberCount = 0;
  const crewMemberNames: string[] = [];
  const crewMemberLeaderIds: string[] = [];

  for (const set of sets) {
    if (set.solo || !set.teamLeaderId.trim()) continue;
    const count = Math.max(0, set.crewMemberCount);
    crewMemberCount += count;
    for (let i = 0; i < count; i++) {
      crewMemberNames.push(set.crewMemberNames[i] ?? '');
      crewMemberLeaderIds.push(set.teamLeaderId.trim());
    }
  }

  return {
    teamLeaderIds,
    soloTeamLeaderIds,
    crewMemberCount,
    crewMemberNames,
    crewMemberLeaderIds,
  };
}

export function mergeLeaderCrewSetsIntoForm<T extends { leaderCrewSets: LeaderCrewSet[] }>(
  prev: T,
  sets: LeaderCrewSet[],
): T {
  return { ...prev, leaderCrewSets: sets, ...syncFlatFromLeaderCrewSets(sets) };
}

export function buildLeaderCrewFormFieldsFromInquiry(params: {
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
  crewMemberNote?: string | null;
  crewMemberCount?: number | null;
  crewLeaderAssignments?: Array<{ crewMemberName: string; teamLeaderId: string; sortOrder?: number | null }>;
}): {
  leaderCrewSets: LeaderCrewSet[];
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
  crewMemberCount: number;
  crewMemberNames: string[];
  crewMemberLeaderIds: string[];
} {
  const leaderCrewSets = initLeaderCrewSetsFromInquiry(params);
  return { leaderCrewSets, ...syncFlatFromLeaderCrewSets(leaderCrewSets) };
}
