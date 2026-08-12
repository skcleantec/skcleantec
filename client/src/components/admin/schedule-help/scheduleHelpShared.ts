/** 스케줄 화면 도움말 — AdminSchedulePage · ScheduleHelpModal 공통 */

export const SCHEDULE_PAGE_OVERVIEW_HELP =
  '예약일(희망일) 기준으로 한 달치 현장 일정을 봅니다. 날짜를 고르면 그날 접수 목록·배정·일정마감 등을 처리할 수 있습니다.';

export function scheduleLegendSlotHelpText(crewUnits: number): string {
  return `오전·오후는 팀장 슬롯 잔여(휴무 반영)입니다. 0보다 작으면 해당 구간이 소진 건수보다 많이 잡혀 있다는 뜻입니다. 팀원은 그날 휴무를 제외한 가용 인원 기준 잔여(명)입니다. 표준 접수는 팀원 ${crewUnits}명 단위로 집계합니다. ⚡ 사이는 팀장 미배정이면서 오전·오후가 아직 확정되지 않은 사이청소 건수입니다. ◇ 조율은 같은 조건의 조율 건수이며, 달력에서 깜빡여 표시됩니다. 오전 또는 오후를 확정하면 해당 배지는 사라지고 슬롯 잔여가 줄어듭니다(미배정 건수는 유지).`;
}

export const SCHEDULE_UNASSIGNED_SECTION_HELP =
  '팀장이 아직 배정되지 않은 자사 접수입니다. 사이청소·조율·일반 접수 모두 오전·오후 확정(또는 희망 시간대)에 따라 미배정 오전/오후/사이·조율·미확정으로 나뉩니다. 팀장 배정 후에는 아래 오전·오후·사이·조율 일정 구역으로 이동합니다.';

export const SCHEDULE_MARKETPLACE_SECTION_HELP =
  '정보공유(준비·공유·인계)에 올린 자사 접수입니다. 팀장 미배정·자사 TO 집계에서는 제외되지만, 스케줄에서 확인·관리할 수 있습니다. 카드 아이콘에 마우스를 올리면 현재 단계가 표시됩니다.';

export type ScheduleHelpTabId = 'calendar' | 'list' | 'custom';

export const SCHEDULE_HELP_TABS: ReadonlyArray<{ id: ScheduleHelpTabId; label: string }> = [
  { id: 'calendar', label: '달력' },
  { id: 'list', label: '일정 목록' },
  { id: 'custom', label: '맞춤 캘린더' },
];
