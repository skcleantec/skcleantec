/** 구조 칩. true 만 표시. 원룸 복층·미닫이 + 집 구조 3칸. 목록은 compact 한 줄. */

const CHIP =
  'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-fluid-2xs font-semibold leading-none ring-1';
const YES = 'bg-rose-100 text-rose-800 ring-rose-300/90';
const UNKNOWN = 'bg-slate-100 text-slate-500 ring-slate-200/80';
const MAX_VISIBLE = 3;

/** 집 구조(베란다·가벽·테라스) 질문 배포일 — 이 시각(UTC) 이전 접수는 「구조 확인 전」 미표시 */
export const HOME_STRUCTURE_FEATURE_SINCE_MS = Date.parse('2026-11-04T15:00:00.000Z'); // 2026-11-05 00:00 KST

type StructureFlags = {
  isOneRoom?: boolean | null;
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  structureBalconyNonExpanded?: boolean | null;
  structurePartitionWall?: boolean | null;
  structureOutdoorTerrace?: boolean | null;
};

type StructureLabel = { full: string; short: string };

function collectLabels(input: StructureFlags): StructureLabel[] {
  const labels: StructureLabel[] = [];
  if (input.isOneRoom) {
    if (input.oneRoomLoft === true) labels.push({ full: '복층', short: '복층' });
    if (input.oneRoomSlidingPartition === true) labels.push({ full: '미닫이 분리형', short: '미닫이' });
  }
  if (input.structureBalconyNonExpanded === true) labels.push({ full: '비확장 베란다', short: '베란다' });
  if (input.structurePartitionWall === true) labels.push({ full: '증축(가벽)', short: '가벽' });
  if (input.structureOutdoorTerrace === true) labels.push({ full: '야외 테라스', short: '테라스' });
  return labels;
}

function createdAtOnOrAfterStructureFeature(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && t >= HOME_STRUCTURE_FEATURE_SINCE_MS;
}

export function hasOneRoomStructureChipContent(
  input: StructureFlags & { createdAt?: string | null },
): boolean {
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

function formatCompactLine(labels: StructureLabel[]): string {
  if (labels.length === 0) return '';
  if (labels.length <= 2) return labels.map((l) => l.short).join('·');
  return `${labels[0].short} 외 ${labels.length - 1}`;
}

export function OneRoomStructureChips({
  isOneRoom,
  oneRoomLoft,
  oneRoomSlidingPartition,
  structureBalconyNonExpanded,
  structurePartitionWall,
  structureOutdoorTerrace,
  createdAt,
  compact = false,
  className = '',
}: StructureFlags & {
  /** 접수 생성 시각 — 「구조 확인 전」은 구조 기능 배포 이후 건만 */
  createdAt?: string | null;
  /** 목록용 — 칩 대신 작은 빨간 글자 한 줄(말줄임) */
  compact?: boolean;
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

  const title = labels.map((l) => l.full).join('·');

  if (compact) {
    if (oneRoomUnknown && labels.length === 0) {
      return (
        <span
          className={`block max-w-full truncate text-fluid-2xs font-semibold leading-tight text-slate-500 ${className}`}
          title="구조 확인 전"
        >
          구조 확인 전
        </span>
      );
    }
    const line = formatCompactLine(labels);
    return (
      <span
        className={`block max-w-full truncate text-fluid-2xs font-semibold leading-tight text-rose-700 ${className}`}
        title={title || undefined}
      >
        {line}
      </span>
    );
  }

  const overflow = labels.length > MAX_VISIBLE;
  const visible = overflow ? labels.slice(0, MAX_VISIBLE - 1) : labels;
  const hiddenCount = overflow ? labels.length - visible.length : 0;

  return (
    <span className={`inline-flex flex-wrap items-center gap-0.5 ${className}`} title={title || undefined}>
      {visible.map((label) => (
        <span key={label.full} className={`${CHIP} ${YES}`}>
          {label.full}
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
