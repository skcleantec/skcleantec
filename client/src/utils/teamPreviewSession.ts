const KEY = 'cbiseo_team_preview_session_v1';

export type TeamPreviewSession = {
  returnPath: string;
  role: 'team_leader' | 'external';
  teamLeaderId?: string;
  externalUserId?: string;
  externalName?: string;
  externalCompanyId?: string;
};

export function safeAdminReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/admin') || path.startsWith('//')) return '/admin/dashboard';
  return path;
}

export function readTeamPreviewSession(): TeamPreviewSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeamPreviewSession;
    if (parsed?.role !== 'team_leader' && parsed?.role !== 'external') return null;
    return { ...parsed, returnPath: safeAdminReturnPath(parsed.returnPath) };
  } catch {
    return null;
  }
}

export function writeTeamPreviewSession(session: TeamPreviewSession): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...session, returnPath: safeAdminReturnPath(session.returnPath) }),
    );
  } catch {
    /* ignore */
  }
}

export function clearTeamPreviewSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function applyTeamPreviewSession(params: URLSearchParams, session: TeamPreviewSession): void {
  if (session.role === 'team_leader' && session.teamLeaderId) {
    params.set('previewRole', 'team_leader');
    params.set('previewTeamLeaderId', session.teamLeaderId);
    return;
  }
  if (session.role !== 'external') return;
  params.set('previewRole', 'external');
  if (session.externalUserId) params.set('previewExternalUserId', session.externalUserId);
  if (session.externalName) params.set('previewExternalName', session.externalName);
  if (session.externalCompanyId) params.set('externalCompanyId', session.externalCompanyId);
}

/** 경로에 미리보기 쿼리가 없으면 세션 값을 붙인다. 이미 있으면 그대로 둔다. */
export function hrefWithTeamPreview(path: string): string {
  const hashIdx = path.indexOf('#');
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : '';
  const before = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  const q = before.indexOf('?');
  const pathname = q >= 0 ? before.slice(0, q) : before;
  const params = new URLSearchParams(q >= 0 ? before.slice(q + 1) : '');
  if (!params.get('previewRole')) {
    const session = readTeamPreviewSession();
    if (session) applyTeamPreviewSession(params, session);
  }
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ''}${hash}`;
}

export function sessionFromPreviewSearch(search: string, returnPath: string): TeamPreviewSession | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const role = params.get('previewRole');
  if (role === 'team_leader') {
    const teamLeaderId = (params.get('previewTeamLeaderId') || '').trim();
    if (!teamLeaderId) return null;
    return { returnPath: safeAdminReturnPath(returnPath), role: 'team_leader', teamLeaderId };
  }
  if (role === 'external') {
    return {
      returnPath: safeAdminReturnPath(returnPath),
      role: 'external',
      externalUserId: params.get('previewExternalUserId')?.trim() || undefined,
      externalName: params.get('previewExternalName')?.trim() || undefined,
      externalCompanyId: params.get('externalCompanyId')?.trim() || undefined,
    };
  }
  return null;
}
