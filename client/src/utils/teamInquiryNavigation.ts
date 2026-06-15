import type { Location } from 'react-router-dom';

export type TeamInquiryNavState = {
  /** `/team/...?openInquiry=` 등 — 상세 모달 복원용 */
  returnTo?: string;
};

function isSafeTeamPath(path: string): boolean {
  return path.startsWith('/team/') && !path.startsWith('//');
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
