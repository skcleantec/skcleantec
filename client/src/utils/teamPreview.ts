/**
 * (레거시) 이메일 화이트리스트 — 일부 서버 기능(배정 등)에서만 여전히 사용.
 * 팀·크루 화면 「미리보기」는 ADMIN/MARKETER 전원에게 열려 있음.
 * Vite: VITE_TEAM_PREVIEW_ADMIN_EMAILS (기본값: pyo)
 */
export function isTeamPreviewAdminEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  const raw = String(import.meta.env.VITE_TEAM_PREVIEW_ADMIN_EMAILS ?? 'pyo');
  const set = new Set(
    raw.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
