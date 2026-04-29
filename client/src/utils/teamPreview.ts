/**
 * 개발·검증용 이메일 화이트리스트.
 * - 관리자 GNB 「미리보기」(팀장·타업체·크루): `ADMIN` 이거나 이 목록에 포함된 계정만 표시.
 * - 서버 일부 기능(배정 등)에서도 사용.
 * Vite: `VITE_TEAM_PREVIEW_ADMIN_EMAILS` (쉼표 구분, 소문자 비교, 기본값: pyo)
 */
export function isTeamPreviewAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const raw = String(import.meta.env.VITE_TEAM_PREVIEW_ADMIN_EMAILS ?? 'pyo');
  const set = new Set(
    raw.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
