/** client/src/utils/orderFormOneRoomStructure.ts 와 같은 규칙 */

export function parseOneRoomYesNo(raw: unknown): boolean | null {
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

export function formatOneRoomSpaceLine(
  roomLabel: string,
  loft: boolean | null,
  sliding: boolean | null,
): string {
  const parts = [roomLabel.trim() || '원룸'];
  if (loft === true) parts.push('복층');
  else if (loft === false) parts.push('복층 아님');
  if (sliding === true) parts.push('미닫이 분리형');
  else if (sliding === false) parts.push('분리형 아님');
  return parts.join(' · ');
}
