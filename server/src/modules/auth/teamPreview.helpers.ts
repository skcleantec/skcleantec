/**
 * 이메일 화이트리스트 — 일부 API(예: ADMIN을 팀장으로 배정)에서만 사용.
 * 팀 라우터(teamAuthMiddleware)의 previewRole 미리보기는 ADMIN·MARKETER 전원 허용.
 * Railway 등: TEAM_PREVIEW_ADMIN_EMAILS=pyo,other@example.com
 */
export function isTeamPreviewAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const raw = process.env.TEAM_PREVIEW_ADMIN_EMAILS ?? 'pyo';
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
