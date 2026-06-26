import { SK_TAEGEUK_FLAG_ASSET } from '@shared/custom/skcleantecOpsUi';

/** SK 스케줄 캘린더 — 팀원 행 아래 태극기 + 미배정 건수 */
export function SkCleantecScheduleUnassignedIndicator({
  count,
  className = '',
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div
      className={`flex justify-center sm:justify-between items-center text-[9px] sm:text-[10px] font-bold text-red-600 leading-none shrink-0 ${className}`}
      title={`팀장 미배정 ${count}건`}
    >
      <span className="flex items-center gap-0.5 min-w-0">
        <img
          src={SK_TAEGEUK_FLAG_ASSET}
          alt=""
          className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 object-contain"
          aria-hidden
        />
        <span className="sm:hidden">미배</span>
        <span className="hidden sm:inline">미배정</span>
      </span>
      <span className="tabular-nums ml-0.5 sm:ml-0">{count}</span>
    </div>
  );
}
