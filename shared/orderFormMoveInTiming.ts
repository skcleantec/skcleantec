/** 발주서·접수 — 이사 구분(10번) 단일 소스 */
export const MOVE_IN_TIMING_VALUES = ['SAME_DAY', 'PLANNED', 'NOT_APPLICABLE'] as const;

export type MoveInTiming = (typeof MOVE_IN_TIMING_VALUES)[number];

export const MOVE_IN_TIMING_OPTIONS: { value: MoveInTiming; label: string }[] = [
  { value: 'SAME_DAY', label: '당일이사' },
  { value: 'PLANNED', label: '이사예정' },
  { value: 'NOT_APPLICABLE', label: '해당없음' },
];

export function parseMoveInTiming(raw: unknown): MoveInTiming | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toUpperCase();
  if (s === 'SAME_DAY' || s === 'PLANNED' || s === 'NOT_APPLICABLE') return s;
  return null;
}

export function labelForMoveInTiming(value: MoveInTiming | string | null | undefined): string {
  if (value == null || value === '') return '—';
  const parsed = parseMoveInTiming(value);
  if (!parsed) return String(value);
  return MOVE_IN_TIMING_OPTIONS.find((o) => o.value === parsed)?.label ?? parsed;
}

export function isMoveInDateInputDisabled(timing: MoveInTiming | null | undefined): boolean {
  return timing === 'NOT_APPLICABLE';
}

export function showMoveInUndecidedOption(timing: MoveInTiming | null | undefined): boolean {
  return timing === 'PLANNED';
}

export interface MoveInFieldInput {
  moveInTiming: MoveInTiming | null | undefined;
  moveInDate?: string | null;
  moveInDateUndecided?: boolean | null;
  preferredDate?: string | null;
}

/** null = 통과, 문자열 = 사용자에게 보여줄 오류 */
export function validateMoveInTimingFields(
  input: MoveInFieldInput,
  opts?: { requireTiming?: boolean },
): string | null {
  const { moveInTiming, moveInDate, moveInDateUndecided } = input;
  const requireTiming = opts?.requireTiming !== false;

  if (!moveInTiming) {
    return requireTiming ? '이사 구분(당일이사·이사예정·해당없음)을 선택해 주세요.' : null;
  }

  const dateStr = moveInDate?.trim() ?? '';
  const undecided = moveInDateUndecided === true;

  if (moveInTiming === 'NOT_APPLICABLE') {
    return null;
  }

  if (moveInTiming === 'PLANNED') {
    if (!undecided && !dateStr) {
      return '이사예정 선택 시 이사 예정일을 입력하거나 「미정」을 선택해 주세요.';
    }
    return null;
  }

  if (moveInTiming === 'SAME_DAY') {
    if (undecided) return '당일이사 선택 시 「미정」은 선택할 수 없습니다.';
    if (!dateStr) return '당일이사 선택 시 이사 날짜를 입력해 주세요.';
    return null;
  }

  return null;
}

export function shouldWarnMoveInDateMismatch(
  timing: MoveInTiming | null | undefined,
  preferredDate: string | null | undefined,
  moveInDate: string | null | undefined,
): boolean {
  if (timing !== 'SAME_DAY') return false;
  const pref = preferredDate?.trim() ?? '';
  const move = moveInDate?.trim() ?? '';
  if (!pref || !move) return false;
  return pref !== move;
}

export function applyMoveInTimingSideEffects(
  timing: MoveInTiming,
  prev: { moveInDate: string; moveInDateUndecided: boolean },
): { moveInDate: string; moveInDateUndecided: boolean } {
  if (timing === 'NOT_APPLICABLE') {
    return { moveInDate: '', moveInDateUndecided: false };
  }
  if (timing === 'SAME_DAY') {
    return { ...prev, moveInDateUndecided: false };
  }
  return prev;
}
