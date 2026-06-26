import { SK_TAEGEUK_FLAG_ASSET } from '@shared/custom/skcleantecOpsUi';

/** SK 스케줄 캘린더 — 태극기 + 자사 미배정 원/투룸 건수(타업체 이관 제외) */
export function SkCleantecScheduleOneRoomIndicator({
  count,
  oneRoomLabel = '원/투룸',
  className = '',
}: {
  count: number;
  oneRoomLabel?: string;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <div
      className={`flex justify-center sm:justify-between items-center text-[9px] sm:text-[10px] font-bold text-slate-800 leading-none shrink-0 ${className}`}
      title={`${oneRoomLabel} 미배정 ${count}건 (타업체 이관 제외)`}
    >
      <span className="flex items-center gap-0.5 min-w-0">
        <img
          src={SK_TAEGEUK_FLAG_ASSET}
          alt=""
          className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 object-contain"
          aria-hidden
        />
        <span className="sm:hidden truncate max-w-[2.5rem]">{oneRoomLabel.slice(0, 2)}</span>
        <span className="hidden sm:inline truncate max-w-[3rem]">{oneRoomLabel}</span>
      </span>
      <span className="tabular-nums ml-0.5 sm:ml-0">{count}</span>
    </div>
  );
}
