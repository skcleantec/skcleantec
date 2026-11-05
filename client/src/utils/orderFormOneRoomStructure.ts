/** 원룸·집 구조. null = 아직 확인 안 함. 복층·미닫이는 isOneRoom 이 false 이면 null. 집 구조 3칸은 원룸과 무관. */

export type OneRoomYesNo = boolean | null;

export const ONE_ROOM_LOFT_YES_SRC = '/orderform/oneroom-loft-yes.svg';
export const ONE_ROOM_LOFT_NO_SRC = '/orderform/oneroom-loft-no.svg';
export const ONE_ROOM_SLIDING_YES_SRC = '/orderform/oneroom-sliding-yes.svg';
export const ONE_ROOM_SLIDING_NO_SRC = '/orderform/oneroom-sliding-no.svg';

export const STRUCTURE_BALCONY_SRC = '/orderform/structure-balcony.svg';
export const STRUCTURE_PARTITION_WALL_SRC = '/orderform/structure-partition-wall.svg';
export const STRUCTURE_TERRACE_SRC = '/orderform/structure-terrace.svg';
export const STRUCTURE_NONE_SRC = '/orderform/structure-none.svg';

export const COUNSELOR_STRUCTURE_HINT =
  '상담사가 표시한 구조예요. 맞으면 「다음」을 눌러 주세요.';

export type HomeStructureFlags = {
  structureBalconyNonExpanded: boolean | null;
  structurePartitionWall: boolean | null;
  structureOutdoorTerrace: boolean | null;
};

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

/** 상담사 체크박스: 체크=true, 미체크=null(고객이 고름). false 는 쓰지 않음. */
export function counselorStructureFlagForSave(checked: boolean): boolean | null {
  return checked ? true : null;
}

export function homeStructureForSave(
  balcony: unknown,
  partition: unknown,
  terrace: unknown,
): HomeStructureFlags {
  return {
    structureBalconyNonExpanded: parseOneRoomYesNo(balcony),
    structurePartitionWall: parseOneRoomYesNo(partition),
    structureOutdoorTerrace: parseOneRoomYesNo(terrace),
  };
}

/** 상담사가 일부만 true 로 남기면 나머지는 false 로 맞춰 고객 화면에 답한 상태로 보이게 함 */
export function coercePartialHomeStructure(flags: HomeStructureFlags): HomeStructureFlags {
  const anyTrue =
    flags.structureBalconyNonExpanded === true ||
    flags.structurePartitionWall === true ||
    flags.structureOutdoorTerrace === true;
  if (!anyTrue) return flags;
  return {
    structureBalconyNonExpanded: flags.structureBalconyNonExpanded === true,
    structurePartitionWall: flags.structurePartitionWall === true,
    structureOutdoorTerrace: flags.structureOutdoorTerrace === true,
  };
}

export function isHomeStructureAnswered(flags: HomeStructureFlags): boolean {
  return (
    flags.structureBalconyNonExpanded != null &&
    flags.structurePartitionWall != null &&
    flags.structureOutdoorTerrace != null
  );
}

export function homeStructureNoneSelected(flags: HomeStructureFlags): boolean {
  return (
    flags.structureBalconyNonExpanded === false &&
    flags.structurePartitionWall === false &&
    flags.structureOutdoorTerrace === false
  );
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

/** 확인 화면 「구조」 줄. true 만 나열, 없으면 「해당 없음」 */
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

export function hasCounselorStructurePrefill(input: {
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
}): boolean {
  return (
    input.oneRoomLoft === true ||
    input.oneRoomSlidingPartition === true ||
    input.structureBalconyNonExpanded === true ||
    input.structurePartitionWall === true ||
    input.structureOutdoorTerrace === true
  );
}
