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

export function homeStructureForSave(
  balcony: unknown,
  partition: unknown,
  terrace: unknown,
): {
  structureBalconyNonExpanded: boolean | null;
  structurePartitionWall: boolean | null;
  structureOutdoorTerrace: boolean | null;
} {
  return {
    structureBalconyNonExpanded: parseOneRoomYesNo(balcony),
    structurePartitionWall: parseOneRoomYesNo(partition),
    structureOutdoorTerrace: parseOneRoomYesNo(terrace),
  };
}

export function isHomeStructureAnswered(flags: {
  structureBalconyNonExpanded: boolean | null;
  structurePartitionWall: boolean | null;
  structureOutdoorTerrace: boolean | null;
}): boolean {
  return (
    flags.structureBalconyNonExpanded != null &&
    flags.structurePartitionWall != null &&
    flags.structureOutdoorTerrace != null
  );
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

export function formatHomeStructureLine(input: {
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
}): string {
  const parts: string[] = [];
  if (input.oneRoomLoft === true) parts.push('복층');
  if (input.oneRoomSlidingPartition === true) parts.push('미닫이 분리형');
  if (input.structureBalconyNonExpanded === true) parts.push('비확장 베란다');
  if (input.structurePartitionWall === true) parts.push('증축(가벽)');
  if (input.structureOutdoorTerrace === true) parts.push('야외 테라스');
  return parts.length > 0 ? parts.join(' · ') : '해당 없음';
}
