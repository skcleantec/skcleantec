import { parseJwtPayload } from './jwtPayload';
import { getToken } from '../stores/auth';
import { getTeamToken } from '../stores/teamAuth';

type StaffJwtPayload = { role?: string; userId?: string };

/** 카카오 연결 페이지 — admin·team JWT가 둘 다 있을 때 올바른 세션 선택 */
export function resolveStaffKakaoLinkAuthToken(): string | null {
  const adminToken = getToken();
  const teamToken = getTeamToken();
  if (!adminToken) return teamToken;
  if (!teamToken) return adminToken;

  const teamRole = parseJwtPayload<StaffJwtPayload>(teamToken)?.role;
  if (teamRole === 'TEAM_LEADER' || teamRole === 'EXTERNAL_PARTNER') {
    return teamToken;
  }

  const adminRole = parseJwtPayload<StaffJwtPayload>(adminToken)?.role;
  if (adminRole === 'ADMIN' || adminRole === 'MARKETER') {
    return adminToken;
  }

  return teamToken;
}
