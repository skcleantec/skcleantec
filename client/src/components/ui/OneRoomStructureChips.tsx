/** 원룸 옆 구조 칩. true 만 표시, 둘 다 아직 모르면 「구조 확인 전」, false 는 칩 없음. */

const CHIP =
  'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-fluid-2xs font-semibold leading-none ring-1';
const YES = 'bg-rose-100 text-rose-800 ring-rose-300/90';
const UNKNOWN = 'bg-slate-100 text-slate-500 ring-slate-200/80';

export function OneRoomStructureChips({
  isOneRoom,
  oneRoomLoft,
  oneRoomSlidingPartition,
  className = '',
}: {
  isOneRoom?: boolean | null;
  oneRoomLoft?: boolean | null;
  oneRoomSlidingPartition?: boolean | null;
  className?: string;
}) {
  if (!isOneRoom) return null;
  const unknown = oneRoomLoft == null && oneRoomSlidingPartition == null;
  if (!unknown && oneRoomLoft !== true && oneRoomSlidingPartition !== true) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-0.5 ${className}`}>
      {oneRoomLoft === true ? <span className={`${CHIP} ${YES}`}>복층</span> : null}
      {oneRoomSlidingPartition === true ? <span className={`${CHIP} ${YES}`}>미닫이 분리형</span> : null}
      {unknown ? <span className={`${CHIP} ${UNKNOWN}`}>구조 확인 전</span> : null}
    </span>
  );
}
