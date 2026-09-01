import { SK_LARGE_AREA_LABEL } from '@shared/custom/skcleantecOpsUi';

/** SK 스케줄 캘린더 — 40평+ 접수 중 팀원 배정 미완 건수 */
export function SkCleantecScheduleLargeAreaIndicator({
  count,
  label = SK_LARGE_AREA_LABEL,
  className = '',
}: {
  count: number;
  label?: string;
  className?: string;
}) {
  if (count <= 0) return null;

  const title = `${label} 접수 ${count}건 · 팀원 배정 미완 (정보공유·타업체 이관 제외)`;

  return (
    <div
      className={`flex justify-center sm:justify-between items-center text-[9px] sm:text-[11px] font-bold text-amber-900 leading-none shrink-0 ${className}`}
      title={title}
    >
      <span className="flex items-center gap-0.5 min-w-0">
        <span
          className="inline-flex h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 items-center justify-center rounded-sm bg-amber-100 text-[7px] sm:text-[8px] font-extrabold text-amber-900 ring-1 ring-amber-400/80"
          aria-hidden
        >
          40
        </span>
        <span className="sm:hidden truncate max-w-[2.5rem]">{label.slice(0, 3)}</span>
        <span className="hidden sm:inline truncate max-w-[3rem]">{label}</span>
      </span>
      <span className="tabular-nums ml-0.5 sm:ml-0">{count}</span>
    </div>
  );
}
