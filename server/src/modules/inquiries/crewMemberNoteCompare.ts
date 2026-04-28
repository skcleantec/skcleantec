/** 쉼표·중점·슬래시 등으로 구분된 이름 토큰을 동일하게 취급하기 위한 비교 전용 정규화 */
const CREW_NOTE_SPLIT_RE = /[,，·‧•/|\\s]+/g;

/** 접수 `crewMemberNote` → 이름 배열 (알림·이력 문구용 — 앱/다른 모듈과 동일 분리 규칙) */
export function parseCrewMemberNoteToNames(v: string | null | undefined): string[] {
  const raw = String(v ?? '').trim();
  if (!raw) return [];
  return raw
    .split(CREW_NOTE_SPLIT_RE)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeCrewMemberNoteForCompare(note: string | null | undefined): string {
  const raw = String(note ?? '').trim();
  if (!raw) return '';
  return raw
    .split(CREW_NOTE_SPLIT_RE)
    .map((x) => x.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .join('\u0001');
}

export function isCrewRosterChanged(
  prevNote: string | null | undefined,
  prevCount: number | null | undefined,
  nextNote: string | null | undefined,
  nextCount: number | null | undefined,
): boolean {
  const a = normalizeCrewMemberNoteForCompare(prevNote);
  const b = normalizeCrewMemberNoteForCompare(nextNote);
  if (a !== b) return true;
  return (prevCount ?? null) !== (nextCount ?? null);
}
