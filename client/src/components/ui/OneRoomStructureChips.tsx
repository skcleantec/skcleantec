/** 구조 칩. true 만 표시. 원룸 복층·미닫이 + 집 구조 3칸. 3개 초과 시 「구조 +N」으로 접음. */

const CHIP =
  'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-fluid-2xs font-semibold leading-none ring-1';
const YES = 'bg-rose-100 text-rose-800 ring-rose-300/90';
const UNKNOWN = 'bg-slate-100 text-slate-500 ring-slate-200/80';
const MAX_VISIBLE = 3;

/** 집 구조(베란다·가벽·테라스) 질문 배포일 — 이 시각(UTC) 이전 접수는 「구조 확인 전」 미표시 */
export const HOME_STRUCTURE_FEATURE_SINCE_MS = Date.parse('2026-11-04T15:00:00.000Z'); // 2026-11-05 00:00 KST

function collectLabels(input: {
  isOneRoom?: boolean | null;
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
}): string[] {
  const labels: string[] = [];
  if (input.isOneRoom) {
    if (input.oneRoomLoft === true) labels.push('복층');
    if (input.oneRoomSlidingPartition === true) labels.push('미닫이 분리형');
  }
  if (input.structureBalconyNonExpanded === true) labels.push('비확장 베란다');
  if (input.structurePartitionWall === true) labels.push('증축(가벽)');
  if (input.structureOutdoorTerrace === true) labels.push('야외 테라스');
  return labels;
}

function createdAtOnOrAfterStructureFeature(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && t >= HOME_STRUCTURE_FEATURE_SINCE_MS;
}

export function hasOneRoomStructureChipContent(input: {
  isOneRoom?: boolean | null;
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
  createdAt?: string | null;
}): boolean {
  if (collectLabels(input).length > 0) return true;
  return (
    createdAtOnOrAfterStructureFeature(input.createdAt) &&
    Boolean(input.isOneRoom) &&
    input.oneRoomLoft == null &&
    input.oneRoomSlidingPartition == null &&
    input.structureBalconyNonExpanded == null &&
    input.structurePartitionWall == null &&
    input.structureOutdoorTerrace == null
  );
}

export function OneRoomStructureChips({
  isOneRoom,
  oneRoomLoft,
  oneRoomSlidingPartition,
  structureBalconyNonExpanded,
  structurePartitionWall,
  structureOutdoorTerrace,
  createdAt,
  className = '',
}: {
  isOneRoom?: boolean | null;
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
  /** 접수 생성 시각 — 「구조 확인 전」은 구조 기능 배포 이후 건만 */
  createdAt?: string | null;
  className?: string;
}) {
  const labels = collectLabels({
    isOneRoom,
    oneRoomLoft,
    oneRoomSlidingPartition,
    structureBalconyNonExpanded,
    structurePartitionWall,
    structureOutdoorTerrace,
  });
  const oneRoomUnknown =
    createdAtOnOrAfterStructureFeature(createdAt) &&
    Boolean(isOneRoom) &&
    oneRoomLoft == null &&
    oneRoomSlidingPartition == null &&
    structureBalconyNonExpanded == null &&
    structurePartitionWall == null &&
    structureOutdoorTerrace == null;

  if (labels.length === 0 && !oneRoomUnknown) return null;

  const overflow = labels.length > MAX_VISIBLE;
  const visible = overflow ? labels.slice(0, MAX_VISIBLE - 1) : labels;
  const hiddenCount = overflow ? labels.length - visible.length : 0;
  const title = labels.join(' · ');

  return (
    <span className={`inline-flex flex-wrap items-center gap-0.5 ${className}`} title={title || undefined}>
      {visible.map((label) => (
        <span key={label} className={`${CHIP} ${YES}`}>
          {label}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className={`${CHIP} ${YES}`} title={title}>
          구조 +{hiddenCount}
        </span>
      ) : null}
      {oneRoomUnknown ? <span className={`${CHIP} ${UNKNOWN}`}>구조 확인 전</span> : null}
    </span>
  );
}
