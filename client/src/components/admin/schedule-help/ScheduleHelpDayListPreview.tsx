import { HelpUiEmbed } from '../../help/ui/helpUiRegistry';
import { SCHEDULE_LEADER_SINGLE_SLOT_HIGHLIGHT_CLASS } from '../../../utils/scheduleLeaderDayAssignmentBalance';
import {
  ScheduleCloseDayButton,
  ScheduleSlotBadge,
  ScheduleToolbarButton,
  ScheduleUnassignedChip,
  scheduleLeaderAdjustButtonClass,
  scheduleStaffAdjustButtonClass,
} from '../../schedule/scheduleUiParts';
import {
  SCHEDULE_LIST_CARD_BORDER_BASE,
  SCHEDULE_LIST_CARD_PRE_ORDER_RING,
  scheduleListCardSlotBgTint,
  scheduleListCardSlotLeftBorder,
} from './scheduleListColorLegend';

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
          <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
            <span className="text-[11px] font-bold text-rose-950 sm:text-fluid-2xs">팀장 미배정</span>
          </div>
          <div className="space-y-1 rounded-md border border-rose-100 bg-white p-1.5">
            <p className="px-1 text-[9px] font-semibold text-amber-800 sm:text-[11px]">미배정 · 오전</p>
            <div
              className={`rounded-xl border p-2 shadow-sm ${scheduleListCardSlotLeftBorder('morning')} ${SCHEDULE_LIST_CARD_BORDER_BASE} ${scheduleListCardSlotBgTint('morning')} ${SCHEDULE_LIST_CARD_PRE_ORDER_RING}`}
            >
              <div className="flex flex-wrap items-center gap-1">
                <ScheduleSlotBadge label="오전" bucket="morning" />
                <span className="text-fluid-2xs font-semibold text-slate-900">김○○</span>
                <ScheduleUnassignedChip />
                <span className="font-bold text-rose-600 text-[9px]">미제출</span>
              </div>
              <p className="mt-1 text-[9px] text-slate-500 sm:text-[11px]">강남구 · 33평 · 오전 · 미배정</p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <span className="text-[11px] font-bold text-amber-950 sm:text-fluid-2xs">오전 일정</span>
          </div>
          <div className="space-y-1 rounded-md border border-amber-100 bg-white p-1.5">
            <div
              className={`rounded-xl border p-2 shadow-sm ${SCHEDULE_LEADER_SINGLE_SLOT_HIGHLIGHT_CLASS}`}
            >
              <div className="flex flex-wrap items-center gap-1">
                <ScheduleSlotBadge label="오전" bucket="morning" />
                <span className="text-fluid-2xs font-semibold text-slate-900">박○○</span>
                <span className="text-[9px] font-medium text-slate-800">홍팀장</span>
              </div>
              <p className="mt-1 text-[9px] text-slate-600 sm:text-[11px]">서초구 · 40평 · 팀장 1건(회색 강조)</p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-2 py-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
            <span className="text-[11px] font-bold text-sky-950 sm:text-fluid-2xs">오후 일정</span>
          </div>
          <div className="rounded-md border border-sky-100 bg-white p-1.5">
            <div
              className={`rounded-xl border p-2 shadow-sm ${scheduleListCardSlotLeftBorder('afternoon')} ${SCHEDULE_LIST_CARD_BORDER_BASE} ${scheduleListCardSlotBgTint('afternoon')}`}
            >
              <div className="flex flex-wrap items-center gap-1">
                <ScheduleSlotBadge label="오후" bucket="afternoon" />
                <HelpUiEmbed tokenId="schedule-marketplace-cart" />
                <span className="text-fluid-2xs font-semibold text-slate-900">이○○</span>
                <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-medium text-emerald-800">
                  해피콜 완료
                </span>
              </div>
              <p className="mt-1 text-[9px] text-slate-500 sm:text-[11px]">송파구 · 28평 · 오후 · 홍팀장 / 팀원 2명</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
