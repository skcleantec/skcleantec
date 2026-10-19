import type { Location } from 'react-router-dom';

export type TeamInquiryNavState = {
  /** `/team/...?openInquiry=` 등 — 상세 모달 복원용 */
  returnTo?: string;
};

function isSafeTeamPath(path: string): boolean {
  return path.startsWith('/team/') && !path.startsWith('//') && !path.includes('://');
}

/** 견적서 등에서 쿼리 `returnTo` — 팀 경로만 허용 */
export function readTeamReturnTo(raw: string | null | undefined, fallback: string): string {
  const path = raw?.trim() ?? '';
  if (path && isSafeTeamPath(path)) return path;
  return fallback;
}

/** 돌아갈 화면 이름. `openInquiry`가 있으면 접수 상세 */
export function teamInquiryReturnLabel(returnTo: string): string {
  if (returnTo.includes('openInquiry=')) return '접수 상세';
  if (returnTo.startsWith('/team/schedule')) return '스케줄';
  if (returnTo.startsWith('/team/dashboard')) return '대시보드';
  if (returnTo.startsWith('/team/assignments')) return '배정목록';
  return '이전';
}

/** 상세 모달 → 촬영·검수 이동 시 돌아올 URL (현재 목록 필터 + openInquiry) */
export function buildTeamInquiryReturnTo(
  from: Pick<Location, 'pathname' | 'search'>,
  inquiryId: string,
): string {
  const params = new URLSearchParams(from.search);
  params.set('openInquiry', inquiryId);
  const q = params.toString();
  return q ? `${from.pathname}?${q}` : from.pathname;
}

export function teamInquiryNavState(returnTo: string): TeamInquiryNavState {
  return { returnTo };
}

/** 촬영·검수 페이지 «이전» — state.returnTo 또는 배정목록+openInquiry */
export function resolveTeamInquiryReturnTo(
  location: Pick<Location, 'state'>,
  inquiryId: string,
  fallbackPathname = '/team/assignments',
): string {
  const state = location.state as TeamInquiryNavState | null;
  if (state?.returnTo && isSafeTeamPath(state.returnTo)) {
    return state.returnTo;
  }
  const params = new URLSearchParams();
  params.set('openInquiry', inquiryId);
  return `${fallbackPathname}?${params.toString()}`;
}
