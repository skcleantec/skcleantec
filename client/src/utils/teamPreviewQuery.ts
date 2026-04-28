/** 팀 화면 URL의 프리뷰 쿼리를 API 요청 URL에 전달 — 관리자 미리보기 전용 */
export function withTeamPreviewQuery(url: string): string {
  if (typeof window === 'undefined') return url;
  const cur = new URLSearchParams(window.location.search);
  const role = cur.get('previewRole');
  const next = new URL(url, window.location.origin);
  if (role === 'external') {
    next.searchParams.set('previewRole', 'external');
    const n = cur.get('previewExternalName');
    if (n) next.searchParams.set('previewExternalName', n);
    const cid = cur.get('externalCompanyId');
    if (cid) next.searchParams.set('externalCompanyId', cid);
  } else if (role === 'team_leader') {
    const id = cur.get('previewTeamLeaderId');
    if (id) {
      next.searchParams.set('previewRole', 'team_leader');
      next.searchParams.set('previewTeamLeaderId', id);
    }
  }
  return `${next.pathname}${next.search}`;
}
