/** 구조 칩. true 만 표시. 원룸 복층·미닫이 + 집 구조 3칸. 3개 초과 시 「구조 +N」으로 접음. */

const CHIP =
  'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-fluid-2xs font-semibold leading-none ring-1';
const YES = 'bg-rose-100 text-rose-800 ring-rose-300/90';
const UNKNOWN = 'bg-slate-100 text-slate-500 ring-slate-200/80';
const MAX_VISIBLE = 3;

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

export function OneRoomStructureChips({
  isOneRoom,
  oneRoomLoft,
  oneRoomSlidingPartition,
  structureBalconyNonExpanded,
  structurePartitionWall,
  structureOutdoorTerrace,
  className = '',
}: {
  isOneRoom?: boolean | null;
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
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
