/** 접수 `crew_member_note` — 상세 모달·배정현황 등에서 공통 파싱 */
export function parseCrewMemberNoteToNames(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[,·/|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}
