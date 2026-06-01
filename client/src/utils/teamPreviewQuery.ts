import { useCallback, useEffect, useRef } from 'react';

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
    const uid = (p.get('previewExternalUserId') || '').trim();
    const cid = (p.get('externalCompanyId') || '').trim();
    const name = (p.get('previewExternalName') || '').trim();
    return `ext:${uid}:${cid}:${name}`;
  }
  return `pr:${role}`;
}

/** 프리뷰 대상 전환 시 이전 in-flight fetch가 state를 덮어쓰지 않도록 */
export function useTeamPreviewStaleGuard(previewKey: string) {
  const keyRef = useRef(previewKey);
  useEffect(() => {
    keyRef.current = previewKey;
  });
  const capturePreviewKey = useCallback(() => keyRef.current, []);
  const isPreviewFetchStale = useCallback((startedKey: string) => startedKey !== keyRef.current, []);
  return { capturePreviewKey, isPreviewFetchStale };
}

function appendTeamPreviewSearchParams(cur: URLSearchParams, next: URL): void {
  const role = cur.get('previewRole');
  if (role === 'external') {
    next.searchParams.set('previewRole', 'external');
    const uid = cur.get('previewExternalUserId');
    if (uid) next.searchParams.set('previewExternalUserId', uid);
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
}

/** 팀 화면 URL의 프리뷰 쿼리를 API 요청 URL에 전달 — 관리자 미리보기 전용 */
export function withTeamPreviewQuery(url: string, search?: string): string {
  const cur = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : ''),
  );
  const next = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  appendTeamPreviewSearchParams(cur, next);
  return `${next.pathname}${next.search}`;
}
