/**
 * @see shared/orderFormMoveInTiming.ts (클라이언트와 동기화)
 */
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

export interface MoveInFieldInput {
  moveInTiming: MoveInTiming | null | undefined;
  moveInDate?: string | null;
  moveInDateUndecided?: boolean | null;
}

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
