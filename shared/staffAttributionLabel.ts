/** 접수·집계·사용자 목록 — 마케터/관리자 표시명 (아이디 구분) */

export type StaffAttributionLabelInput = {
  name: string;
  loginId: string;
  role?: string | null;
};

/** 마케터별 집계·접수자 필터 등 — ADMIN은 「관리자」 접두 + 아이디 */
export function formatStaffAttributionLabel(input: StaffAttributionLabelInput): string {
  const name = input.name.trim();
  const loginId = input.loginId.trim();
  if (input.role === 'ADMIN') {
    return loginId ? `관리자 · ${name} (${loginId})` : `관리자 · ${name}`;
  }
  return loginId ? `${name} (${loginId})` : name;
}

/** 사용자등록 마케터 탭 — ADMIN 전용 짧은 라벨 */
export function formatAdminRosterLabel(input: Pick<StaffAttributionLabelInput, 'name' | 'loginId'>): string {
  const loginId = input.loginId.trim();
  return loginId ? `관리자 · ${input.name.trim()} (${loginId})` : `관리자 · ${input.name.trim()}`;
}
