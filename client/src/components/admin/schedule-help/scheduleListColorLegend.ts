/** 선택일 일정 목록 — 구역 헤더·접수 카드 색 (도움말·실제 목록 공통) */

import { SCHEDULE_ALL_DAY_HIGHLIGHT_CLASS, SCHEDULE_LEADER_SINGLE_SLOT_HIGHLIGHT_CLASS } from '../../../utils/scheduleLeaderDayAssignmentBalance';

export type ScheduleListCardBucket = 'allday' | 'morning' | 'afternoon' | 'other';

export const SCHEDULE_LIST_SLOT_LEFT_BORDER: Record<ScheduleListCardBucket, string> = {
  allday: 'border-l-[6px] border-emerald-600',
  morning: 'border-l-[6px] border-amber-500',
  afternoon: 'border-l-[6px] border-sky-600',
  other: 'border-l-[6px] border-violet-500',
};

export const SCHEDULE_LIST_SLOT_BG_TINT: Record<ScheduleListCardBucket, string> = {
  allday: 'bg-emerald-50/60',
  morning: 'bg-amber-50/50',
  afternoon: 'bg-sky-50/50',
  other: 'bg-violet-50/40',
};

export const SCHEDULE_LIST_CARD_BORDER_BASE = 'border-slate-200/90';

export const SCHEDULE_LIST_CARD_PRE_ORDER_RING = 'ring-1 ring-red-500';
export const SCHEDULE_LIST_CARD_ON_HOLD_RING = 'ring-1 ring-amber-500';
export const SCHEDULE_LIST_CARD_ON_HOLD_BG = 'bg-amber-50/40';
export const SCHEDULE_LIST_CARD_CANCELLED = 'opacity-[0.88] saturate-[0.65]';
export const SCHEDULE_LIST_CARD_COORD_PULSE = 'motion-safe:animate-pulse';
export const SCHEDULE_LIST_CARD_SK_ONE_ROOM =
  'border-red-300/90 ring-1 ring-red-200/80 bg-red-50/30';

export function scheduleListCardSlotLeftBorder(bucket: ScheduleListCardBucket): string {
  return SCHEDULE_LIST_SLOT_LEFT_BORDER[bucket];
}

export function scheduleListCardSlotBgTint(bucket: ScheduleListCardBucket): string {
  return SCHEDULE_LIST_SLOT_BG_TINT[bucket];
}

export type ScheduleListSectionLegendItem = {
  title: string;
  headerBarClass: string;
  dotClass: string;
  titleClass: string;
  meaning: string;
};

/** 목록 구역 헤더 바 — AdminSchedulePage 선택일 목록 순서와 동일 */
export const SCHEDULE_LIST_SECTION_LEGEND: readonly ScheduleListSectionLegendItem[] = [
  {
    title: '팀장 미배정',
    headerBarClass: 'bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5',
    dotClass: 'h-2 w-2 rounded-full bg-rose-500 shrink-0',
    titleClass: 'text-fluid-xs font-bold text-rose-950',
    meaning:
      '팀장이 아직 없는 자사 접수입니다. 아래에 미배정·종일 / ·오전 / ·오후 / ·사이·조율·미확정으로 나뉩니다.',
  },
  {
    title: '종일 일정',
    headerBarClass: 'bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5',
    dotClass: 'h-2 w-2 rounded-full bg-emerald-600 shrink-0',
    titleClass: 'text-fluid-xs font-bold text-emerald-950',
    meaning:
      '하루 종일 한 건만 수행하는 접수입니다. 오전·오후 TO 슬롯을 모두 사용합니다. 관리자·마케터만 지정할 수 있습니다.',
  },
  {
    title: '정보공유',
    headerBarClass: 'bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5',
    dotClass: 'h-2 w-2 rounded-full bg-violet-500 shrink-0',
    titleClass: 'text-fluid-xs font-bold text-violet-950',
    meaning: '정보공유(장바구니)에 올린 접수입니다. 기능을 쓰는 업체만 표시됩니다.',
  },
  {
    title: '오전 일정',
    headerBarClass: 'bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5',
    dotClass: 'h-2 w-2 rounded-full bg-amber-500 shrink-0',
    titleClass: 'text-fluid-xs font-bold text-amber-950',
    meaning: '팀장이 배정된 자사 접수 — 오전 시간대입니다.',
  },
  {
    title: '오후 일정',
    headerBarClass: 'bg-sky-50 border border-sky-100 rounded-lg px-3 py-1.5',
    dotClass: 'h-2 w-2 rounded-full bg-sky-500 shrink-0',
    titleClass: 'text-fluid-xs font-bold text-sky-950',
    meaning: '팀장이 배정된 자사 접수 — 오후 시간대입니다.',
  },
  {
    title: '사이 · 일정 미확정',
    headerBarClass: 'bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5',
    dotClass: 'h-2 w-2 rounded-full bg-violet-500 shrink-0',
    titleClass: 'text-fluid-xs font-bold text-violet-950',
    meaning:
      '사이청소·조율인데 오전/오후가 아직 정해지지 않았거나, 시간대가 비어 있는 접수입니다.',
  },
  {
    title: '파트너 일정',
    headerBarClass:
      'rounded-lg border-2 border-indigo-200/90 bg-indigo-50/40 px-3 py-2.5 text-fluid-sm font-bold text-indigo-950',
    dotClass: '',
    titleClass: '',
    meaning: '파트너 연계 접수입니다. 접어서 오전·오후·사이별로 볼 수 있습니다.',
  },
  {
    title: '타업체 일정',
    headerBarClass:
      'rounded-lg border-2 border-indigo-300/90 bg-indigo-50/50 px-3 py-2.5 text-fluid-sm font-bold text-indigo-950',
    dotClass: '',
    titleClass: '',
    meaning: '타업체로 보낸 접수입니다. 업체 미연결·업체별 묶음으로 펼칩니다.',
  },
  {
    title: '취소·보류',
    headerBarClass: 'text-fluid-sm font-bold text-slate-800',
    dotClass: '',
    titleClass: '',
    meaning: '일반 일정과 분리된 하단 선반입니다. 접어서 펼칩니다.',
  },
  {
    title: 'A/S (C/S 예정)',
    headerBarClass:
      'border-b border-red-400/70 pb-1.5 text-fluid-sm font-bold text-red-700',
    dotClass: '',
    titleClass: '',
    meaning: '예약 청소와 별도인 후속 A/S·C/S 일정입니다. 빨간 카드로 표시됩니다.',
  },
];

export type ScheduleListCardColorLegendItem = {
  sampleLabel: string;
  cardClass: string;
  meaning: string;
};

/** 접수 카드 칸 배경·띠·테두리 — ScheduleDayListItem과 동일 계열 */
export const SCHEDULE_LIST_CARD_COLOR_LEGEND: readonly ScheduleListCardColorLegendItem[] = [
  {
    sampleLabel: '종일',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.allday} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_ALL_DAY_HIGHLIGHT_CLASS}`,
    meaning: '종일 일정 — 왼쪽 emerald 띠·연한 초록 배경·진한 테두리(오전/오후 TO 모두 사용)',
  },
  {
    sampleLabel: '오전',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.morning} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LIST_SLOT_BG_TINT.morning}`,
    meaning: '오전 시간대 — 왼쪽 노란 띠·연한 노란 배경',
  },
  {
    sampleLabel: '오후',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.afternoon} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LIST_SLOT_BG_TINT.afternoon}`,
    meaning: '오후 시간대 — 왼쪽 파란 띠·연한 하늘색 배경',
  },
  {
    sampleLabel: '사이·조율',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.other} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LIST_SLOT_BG_TINT.other}`,
    meaning: '사이청소·조율·시간 미확정 — 왼쪽 보라 띠·연한 보라 배경',
  },
  {
    sampleLabel: '팀장 1건',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.morning} ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LEADER_SINGLE_SLOT_HIGHLIGHT_CLASS}`,
    meaning:
      '그날 해당 슬롯(오전 또는 오후)에 팀장 배정 1건뿐 — 왼쪽 시간대 띠 유지, 연한 배경·진한 테두리·「1건」 뱃지. 추가 배정 검토.',
  },
  {
    sampleLabel: '처리 전',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.morning} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LIST_SLOT_BG_TINT.morning} ${SCHEDULE_LIST_CARD_PRE_ORDER_RING}`,
    meaning: '대기·입금완료·발주서 미제출 등 아직 본 일정으로 잡히지 않은 접수 — 빨간 테두리',
  },
  {
    sampleLabel: '보류',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.afternoon} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LIST_SLOT_BG_TINT.afternoon} ${SCHEDULE_LIST_CARD_ON_HOLD_RING} ${SCHEDULE_LIST_CARD_ON_HOLD_BG}`,
    meaning: '보류 상태 — 노란 테두리·연한 노란 배경',
  },
  {
    sampleLabel: '취소',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.morning} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LIST_SLOT_BG_TINT.morning} ${SCHEDULE_LIST_CARD_CANCELLED}`,
    meaning: '취소된 접수 — 흐리고 채도가 낮게 표시됩니다',
  },
  {
    sampleLabel: '조율 미확정',
    cardClass: `${SCHEDULE_LIST_SLOT_LEFT_BORDER.other} border ${SCHEDULE_LIST_CARD_BORDER_BASE} ${SCHEDULE_LIST_SLOT_BG_TINT.other} ${SCHEDULE_LIST_CARD_COORD_PULSE}`,
    meaning: '조율인데 오전/오후가 정해지지 않은 카드 — 목록에서 깜빡입니다',
  },
];
