import type { ButtonHTMLAttributes, ReactNode } from 'react';

type PreviewButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  className: string;
};

/** 도움말·실제 화면 공통 — pointer-events 는 호출 측에서 제어 */
export function ScheduleToolbarButton({ className, children, ...rest }: PreviewButtonProps) {
  return (
    <button type="button" className={className} {...rest}>
      {children}
    </button>
  );
}

export const scheduleCloseDayButtonClass =
  'px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded-md bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 leading-snug whitespace-nowrap';

export const scheduleReleaseDayButtonClass =
  'px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 leading-snug sm:whitespace-nowrap';

export const scheduleStaffAdjustButtonClass =
  'px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 leading-snug whitespace-nowrap';

export const scheduleLeaderAdjustButtonClass =
  'px-1.5 py-0.5 text-fluid-2xs sm:px-2 sm:py-1 sm:text-fluid-xs md:px-3 md:py-1.5 md:text-fluid-xs font-medium rounded border border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100 leading-snug whitespace-nowrap';

export const scheduleMapButtonClass =
  'inline-flex items-center justify-center shrink-0 size-[clamp(2rem,5.5vmin,2.5rem)] min-h-[32px] min-w-[32px] rounded-full border-[1.5px] border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm touch-manipulation sm:size-10 sm:border-2';

export function ScheduleCloseDayButton(props: Omit<PreviewButtonProps, 'className' | 'children'>) {
  return (
    <ScheduleToolbarButton className={scheduleCloseDayButtonClass} {...props}>
      일정마감
    </ScheduleToolbarButton>
  );
}

export function ScheduleReleaseDayButton(props: Omit<PreviewButtonProps, 'className' | 'children'>) {
  return (
    <ScheduleToolbarButton className={scheduleReleaseDayButtonClass} {...props}>
      일정마감 해제
    </ScheduleToolbarButton>
  );
}

export function scheduleSlotBadgeClass(bucket: 'morning' | 'afternoon' | 'other', isSide: boolean): string {
  if (isSide) return 'bg-violet-100 text-violet-950 border border-violet-300';
  if (bucket === 'morning') return 'bg-amber-200/90 text-amber-950 border border-amber-400';
  if (bucket === 'afternoon') return 'bg-sky-200/90 text-sky-950 border border-sky-500';
  return 'bg-violet-100 text-violet-950 border border-violet-300';
}

export function ScheduleSlotBadge({
  label,
  bucket,
  isSide = label === '사이',
}: {
  label: '오전' | '오후' | '사이';
  bucket?: 'morning' | 'afternoon' | 'other';
  isSide?: boolean;
}) {
  const resolvedBucket =
    bucket ?? (label === '오전' ? 'morning' : label === '오후' ? 'afternoon' : 'other');
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center min-w-[2.25rem] px-1.5 py-0.5 text-fluid-2xs font-bold leading-none rounded-lg ${scheduleSlotBadgeClass(resolvedBucket, isSide || label === '사이')}`}
    >
      {label}
    </span>
  );
}

export function ScheduleUnassignedChip() {
  return (
    <span className="inline-flex font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-px rounded text-fluid-2xs">
      미배정
    </span>
  );
}
