/**
 * 관리자·마케터가 팀장 API/화면을 미리볼 수 있는 계정 (이메일 로그인 기준, 소문자 비교)
 * Railway 등: TEAM_PREVIEW_ADMIN_EMAILS=admin2,admin2@example.com
 */
export function isTeamPreviewAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const raw = process.env.TEAM_PREVIEW_ADMIN_EMAILS ?? 'admin2';
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
