import { HelpUiEmbed } from '../../help/ui/helpUiRegistry';
import {
  ScheduleCloseDayButton,
  ScheduleSlotBadge,
  ScheduleToolbarButton,
  ScheduleUnassignedChip,
  scheduleLeaderAdjustButtonClass,
  scheduleStaffAdjustButtonClass,
} from '../../schedule/scheduleUiParts';

/** 선택일 일정 목록 — 실제 UI 조합 미리보기 (스크린샷 대체) */
export function ScheduleHelpDayListPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 shadow-sm pointer-events-none select-none">
      <div className="border-b border-slate-200 bg-white px-2.5 py-2 sm:px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-fluid-xs font-semibold text-slate-900 tabular-nums">6월 16일 (월)</p>
          <div className="flex flex-wrap items-center gap-1">
            <ScheduleToolbarButton className={scheduleStaffAdjustButtonClass} tabIndex={-1} aria-hidden disabled>
              인원조정
            </ScheduleToolbarButton>
            <ScheduleToolbarButton className={scheduleLeaderAdjustButtonClass} tabIndex={-1} aria-hidden disabled>
              팀장조정
            </ScheduleToolbarButton>
            <ScheduleCloseDayButton tabIndex={-1} aria-hidden disabled />
          </div>
        </div>
      </div>

      <div className="space-y-2 p-2 sm:p-2.5">
        <div>
          <div className="rounded-t-md border border-b-0 border-rose-200 bg-rose-100/90 px-2 py-1 text-[10px] font-bold text-rose-900 sm:text-fluid-2xs">
            팀장 미배정
          </div>
          <div className="rounded-b-md border border-rose-100 bg-white p-1.5 space-y-1">
            <p className="px-1 text-[9px] font-semibold text-amber-800 sm:text-[10px]">미배정 · 오전</p>
            <div className="rounded-lg border border-amber-200 border-l-[5px] border-l-amber-500 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-1">
                <ScheduleSlotBadge label="오전" bucket="morning" />
                <span className="text-fluid-2xs font-semibold text-slate-900">김○○</span>
                <ScheduleUnassignedChip />
                <span className="ml-auto rounded border border-blue-200 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                  메모
                </span>
              </div>
              <p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">강남구 · 33평 · 오전 · 미배정</p>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-t-md border border-b-0 border-sky-200 bg-sky-100/90 px-2 py-1 text-[10px] font-bold text-sky-900 sm:text-fluid-2xs">
            오후 일정
          </div>
          <div className="rounded-b-md border border-sky-100 bg-white p-1.5">
            <div className="rounded-lg border border-sky-200 border-l-[5px] border-l-sky-500 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-1">
                <ScheduleSlotBadge label="오후" bucket="afternoon" />
                <HelpUiEmbed tokenId="schedule-marketplace-cart" />
                <span className="text-fluid-2xs font-semibold text-slate-900">이○○</span>
                <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-medium text-emerald-800">
                  해피콜 완료
                </span>
              </div>
              <p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">송파구 · 28평 · 오후 · 홍팀장 / 팀원 2명</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
