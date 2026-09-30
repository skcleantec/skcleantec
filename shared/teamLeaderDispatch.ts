/** 팀장 배정 성향 — 없으면 하루 2건, 크기 제한 없음 */

export const TEAM_LEADER_SIZE_POLICIES = [
  'UNRESTRICTED',
  'ONE_ROOM_ONLY',
  'ONE_AND_TWO',
  'EXCLUDE_ONE_AND_TWO',
] as const;

export type TeamLeaderSizePolicyId = (typeof TEAM_LEADER_SIZE_POLICIES)[number];

export const TEAM_LEADER_DEFAULT_SIZE_POLICY: TeamLeaderSizePolicyId = 'UNRESTRICTED';

export const TEAM_LEADER_SIZE_POLICY_LABEL: Record<TeamLeaderSizePolicyId, string> = {
  UNRESTRICTED: '크기 제한 없음',
  ONE_ROOM_ONLY: '원룸만',
  ONE_AND_TWO: '원룸·투룸',
  EXCLUDE_ONE_AND_TWO: '원룸·투룸 제외',
};

export const TEAM_LEADER_JOBS_PER_DAY_OPTIONS = [1, 2] as const;
export const TEAM_LEADER_DEFAULT_JOBS_PER_DAY = 2;

export function isTeamLeaderSizePolicy(value: string): value is TeamLeaderSizePolicyId {
  return (TEAM_LEADER_SIZE_POLICIES as readonly string[]).includes(value);
}

export function parseTeamLeaderJobsPerDay(value: unknown): 1 | 2 | null {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? '').trim(), 10);
  if (n === 1 || n === 2) return n;
  return null;
}
