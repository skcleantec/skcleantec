/** 원룸 세부. null = 아직 확인 안 함. isOneRoom 이 false 이면 둘 다 null. */

export type OneRoomYesNo = boolean | null;

export const ONE_ROOM_LOFT_YES_SRC = '/orderform/oneroom-loft-yes.svg';
export const ONE_ROOM_LOFT_NO_SRC = '/orderform/oneroom-loft-no.svg';
export const ONE_ROOM_SLIDING_YES_SRC = '/orderform/oneroom-sliding-yes.svg';
export const ONE_ROOM_SLIDING_NO_SRC = '/orderform/oneroom-sliding-no.svg';

export function parseOneRoomYesNo(raw: unknown): OneRoomYesNo {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return null;
}

export function oneRoomStructureForSave(
  isOneRoom: boolean,
  loft: unknown,
  sliding: unknown,
): { oneRoomLoft: boolean | null; oneRoomSlidingPartition: boolean | null } {
  if (!isOneRoom) return { oneRoomLoft: null, oneRoomSlidingPartition: null };
  return {
    oneRoomLoft: parseOneRoomYesNo(loft),
    oneRoomSlidingPartition: parseOneRoomYesNo(sliding),
  };
}

/** 확인 화면 「공간」 줄. 예: 원룸 · 복층 · 미닫이 분리형 */
export function formatOneRoomSpaceLine(
  roomLabel: string,
  loft: OneRoomYesNo,
  sliding: OneRoomYesNo,
): string {
  const parts = [roomLabel.trim() || '원룸'];
  if (loft === true) parts.push('복층');
  else if (loft === false) parts.push('복층 아님');
  if (sliding === true) parts.push('미닫이 분리형');
  else if (sliding === false) parts.push('분리형 아님');
  return parts.join(' · ');
}
