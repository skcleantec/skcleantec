/**
 * 관리자·마케터가 팀장 화면 미리보기 가능한 로그인 이메일 (Vite: VITE_TEAM_PREVIEW_ADMIN_EMAILS)
 * 기본값: admin2 (로컬 테스트용)
 */
export function isTeamPreviewAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const raw = import.meta.env.VITE_TEAM_PREVIEW_ADMIN_EMAILS ?? 'admin2';
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
