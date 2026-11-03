/** SK 원/투룸 세부. 원/투룸 미체크면 항상 null */
export type OneTwoRoomKind = 'ONE' | 'TWO' | null;

export function parseOneTwoRoomKind(v: unknown): OneTwoRoomKind {
  return v === 'ONE' || v === 'TWO' ? v : null;
}

/** SK 스케줄 카드 면적 줄. 다른 테넌트는 기존 라벨 그대로. */
export function scheduleListOneRoomPhrase(sk: boolean, kind: unknown, fallback: string): string {
  if (!sk) return fallback;
  if (kind === 'ONE') return '원룸';
  if (kind === 'TWO') return '투룸';
  return fallback;
}

/** 원룸·투룸은 배타. 한쪽을 켜면 원/투룸도 켜고, 원/투룸을 끄면 둘 다 끈다. */
export function nextOneTwoRoomFields(
  prev: { isOneRoom: boolean; oneTwoRoomKind: OneTwoRoomKind },
  which: 'parent' | 'ONE' | 'TWO',
  checked: boolean,
): { isOneRoom: boolean; oneTwoRoomKind: OneTwoRoomKind } {
  if (which === 'parent') {
    return checked
      ? { isOneRoom: true, oneTwoRoomKind: prev.oneTwoRoomKind }
      : { isOneRoom: false, oneTwoRoomKind: null };
  }
  if (!checked) {
    return {
      isOneRoom: prev.isOneRoom,
      oneTwoRoomKind: prev.oneTwoRoomKind === which ? null : prev.oneTwoRoomKind,
    };
  }
  return { isOneRoom: true, oneTwoRoomKind: which };
}
