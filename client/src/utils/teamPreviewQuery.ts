/**
 * 관리자·마케터가 동일 팀 JWT로 미리보기할 때 `previewTeamLeaderId`·타업체 쿼리만 바뀌고
 * `getTeamToken()`은 그대로라 `useCallback([token])`만으로는 재조회가 안 되는 문제 방지용 deps 키.
 */
export function teamPreviewDepsKey(search: string): string {
  const p = new URLSearchParams(search);
  const role = p.get('previewRole');
  if (!role) return '';
  if (role === 'team_leader') return `tl:${(p.get('previewTeamLeaderId') || '').trim()}`;
  if (role === 'external') {
    const cid = (p.get('externalCompanyId') || '').trim();
    const name = (p.get('previewExternalName') || '').trim();
    return `ext:${cid}:${name}`;
  }
  return `pr:${role}`;
}

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
