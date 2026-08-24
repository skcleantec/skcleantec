import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../../../constants/crewCapacity';
import { SonEomneungNalIcon } from '../../schedule/SonEomneungNalIcon';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { SON_EOMNEUNG_NAL_HELP } from '../../../utils/sonEomneungNal';
import { SCHEDULE_LEADER_SINGLE_SLOT_LEGEND_SWATCH_CLASS } from '../../../utils/scheduleLeaderDayAssignmentBalance';
import { scheduleLegendSlotHelpText } from './scheduleHelpShared';

/** 스케줄 좌측 범례 · 도움말 모달 공통 */
export function ScheduleLegendItems({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center text-slate-600 ${
        compact ? 'gap-x-3 gap-y-1 text-[10px] leading-snug' : 'gap-x-5 gap-y-2 text-fluid-xs leading-relaxed'
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className={SCHEDULE_LEADER_SINGLE_SLOT_LEGEND_SWATCH_CLASS} />
        <span>
          팀장 <span className="font-semibold text-slate-800">오전·오후 1건</span>
          {compact ? '' : ' (추가 배정 검토)'}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full border-2 border-rose-500 bg-white" />
        <span>
          {compact ? (
            '미배정'
          ) : (
            <>
              빈 슬롯·<span className="font-bold text-red-600">미배정</span>
            </>
          )}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-100 ring-2 ring-rose-400" />
        대기
      </span>
      <span className="inline-flex items-center gap-1.5" title="발주서 미제출·대기 접수가 있는 날">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
        미제출
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-md bg-slate-200" />
        마감
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-900" />
        선택한 날
      </span>
      <span className="inline-flex items-center gap-1.5" title={SON_EOMNEUNG_NAL_HELP}>
        <SonEomneungNalIcon />
        손없는날
      </span>
      {!compact ? (
        <div className="flex w-full min-w-0 justify-end min-[520px]:w-auto min-[520px]:flex-1 min-[520px]:basis-0">
          <HelpTooltip className="shrink-0" text={scheduleLegendSlotHelpText(DEFAULT_CREW_UNITS_PER_INQUIRY)} />
        </div>
      ) : (
        <HelpTooltip className="shrink-0" text={scheduleLegendSlotHelpText(DEFAULT_CREW_UNITS_PER_INQUIRY)} />
      )}
    </div>
  );
}
