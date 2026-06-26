import { SK_TAEGEUK_FLAG_ASSET } from '@shared/custom/skcleantecOpsUi';

/** SK 스케줄 캘린더 — 태극기 + 자사 관리 대상 원/투룸 건수(타업체 이관 제외) */
export function SkCleantecScheduleOneRoomIndicator({
  count,
  oneRoomLabel = '원/투룸',
  highlighted = true,
  unassignedCount = 0,
  className = '',
}: {
  count: number;
  oneRoomLabel?: string;
  /** 미배정 원/투룸이 있을 때 강조(태극기·테두리) */
  highlighted?: boolean;
  unassignedCount?: number;
  className?: string;
}) {
  if (count <= 0) return null;

  const titleParts = [`${oneRoomLabel} ${count}건`];
  if (unassignedCount > 0) titleParts.push(`미배정 ${unassignedCount}건`);
  titleParts.push('타업체 이관 건 제외');

  return (
    <div
      className={`flex justify-center sm:justify-between items-center gap-1 text-[10px] sm:text-[11px] font-extrabold leading-none shrink-0 rounded-md px-1 sm:px-1.5 py-0.5 ${
        highlighted
          ? 'bg-gradient-to-r from-red-50 via-white to-blue-50 ring-2 ring-red-400/90 text-red-900 shadow-sm'
          : 'bg-slate-50 ring-1 ring-slate-300/90 text-slate-700'
      } ${className}`}
      title={titleParts.join(' · ')}
    >
      <span className="flex items-center gap-0.5 sm:gap-1 min-w-0">
        <img
          src={SK_TAEGEUK_FLAG_ASSET}
          alt=""
          className={`shrink-0 object-contain drop-shadow-sm ${
            highlighted ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-80'
          }`}
          aria-hidden
        />
        <span className="sm:hidden truncate max-w-[2.75rem]">{oneRoomLabel.slice(0, 2)}</span>
        <span className="hidden sm:inline truncate max-w-[3.5rem]">{oneRoomLabel}</span>
      </span>
      <span className={`tabular-nums ml-0.5 sm:ml-0 ${highlighted ? 'text-red-800' : ''}`}>{count}</span>
    </div>
  );
}
