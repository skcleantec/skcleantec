import type { ReactNode } from 'react';
import { SCHEDULE_LEADER_SINGLE_SLOT_LEGEND_SWATCH_CLASS } from '../../../utils/scheduleLeaderDayAssignmentBalance';
import {
  SCHEDULE_LIST_CARD_COLOR_LEGEND,
  SCHEDULE_LIST_SECTION_LEGEND,
  type ScheduleListCardColorLegendItem,
  type ScheduleListSectionLegendItem,
} from './scheduleListColorLegend';

export function ScheduleListSectionHeaderSample({ item }: { item: ScheduleListSectionLegendItem }) {
  if (item.dotClass) {
    return (
      <div className={`flex min-w-[8.5rem] items-center gap-2 ${item.headerBarClass}`}>
        <span className={item.dotClass} aria-hidden />
        <span className={item.titleClass}>{item.title}</span>
      </div>
    );
  }
  return <span className={`inline-block min-w-[8.5rem] ${item.headerBarClass}`}>{item.title}</span>;
}

export function ScheduleListCardColorSample({ item }: { item: ScheduleListCardColorLegendItem }) {
  return (
    <div
      className={`min-w-[7.5rem] max-w-[9rem] rounded-xl border py-1.5 pl-2 pr-1.5 text-[10px] font-semibold text-slate-800 shadow-sm ${item.cardClass}`}
    >
      {item.sampleLabel}
    </div>
  );
}

export function ScheduleListLeaderSingleSlotSwatch() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={SCHEDULE_LEADER_SINGLE_SLOT_LEGEND_SWATCH_CLASS} aria-hidden />
      <span className="text-[10px] text-slate-700">팀장 1건</span>
    </span>
  );
}

export function buildScheduleListSectionHelpRows(): ReadonlyArray<{
  sample: ReactNode;
  meaning: string;
}> {
  return SCHEDULE_LIST_SECTION_LEGEND.map((item) => ({
    sample: <ScheduleListSectionHeaderSample item={item} />,
    meaning: item.meaning,
  }));
}

export function buildScheduleListCardColorHelpRows(): ReadonlyArray<{
  sample: ReactNode;
  meaning: string;
}> {
  return SCHEDULE_LIST_CARD_COLOR_LEGEND.map((item) => ({
    sample: <ScheduleListCardColorSample item={item} />,
    meaning: item.meaning,
  }));
}
