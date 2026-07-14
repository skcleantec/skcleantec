import {
  inquiryListSortTier,
  isInquiryListPinnedPreReceive,
  type InquiryListPinTier,
  type InquiryListSortable,
} from '../../../shared/inquiryListSort';

export { inquiryListSortTier, isInquiryListPinnedPreReceive, type InquiryListPinTier };

export const INQUIRY_LIST_PIN_TIER_LABELS: Record<Exclude<InquiryListPinTier, 4>, string> = {
  0: '미제출',
  1: '입금완료',
  2: '입금대기',
  3: '대기',
};

type PinTierStyle = {
  /** PC sticky 셀·행 배경 */
  stickyBg: string;
  stickyHover: string;
  stickyR: string;
  rowHover: string;
  /** 행 상·하 border */
  pBorder: string;
  /** sticky 좌측 강조 */
  stickyLeft: string;
  /** 작업 열 우측 강조 */
  stickyRight: string;
  /** 모바일 카드 shell */
  mobileCard: string;
  /** tier 그룹 경계 (첫 행) */
  groupTop: string;
};

const PIN_TIER_STYLES: Record<Exclude<InquiryListPinTier, 4>, PinTierStyle> = {
  0: {
    stickyBg: 'bg-red-50/50',
    stickyHover: 'group-hover:bg-red-50/80',
    stickyR: 'border-r border-red-200',
    rowHover: 'hover:bg-red-50/70',
    pBorder: 'border-t-2 border-b-2 border-red-400',
    stickyLeft: 'border-l-2 border-l-red-500',
    stickyRight: 'border-r-2 border-r-red-500',
    mobileCard: 'border-red-400 bg-red-50/50 ring-1 ring-red-200/30',
    groupTop: 'border-t-2 border-red-300',
  },
  1: {
    stickyBg: 'bg-emerald-50/45',
    stickyHover: 'group-hover:bg-emerald-50/75',
    stickyR: 'border-r border-emerald-200',
    rowHover: 'hover:bg-emerald-50/65',
    pBorder: 'border-t-2 border-b-2 border-emerald-400',
    stickyLeft: 'border-l-2 border-l-emerald-500',
    stickyRight: 'border-r-2 border-r-emerald-500',
    mobileCard: 'border-emerald-400 bg-emerald-50/45 ring-1 ring-emerald-200/30',
    groupTop: 'border-t-2 border-emerald-300',
  },
  2: {
    stickyBg: 'bg-sky-50/50',
    stickyHover: 'group-hover:bg-sky-50/80',
    stickyR: 'border-r border-sky-200',
    rowHover: 'hover:bg-sky-50/70',
    pBorder: 'border-t-2 border-b-2 border-sky-400',
    stickyLeft: 'border-l-2 border-l-sky-500',
    stickyRight: 'border-r-2 border-r-sky-500',
    mobileCard: 'border-sky-400 bg-sky-50/50 ring-1 ring-sky-200/30',
    groupTop: 'border-t-2 border-sky-300',
  },
  3: {
    stickyBg: 'bg-amber-50/45',
    stickyHover: 'group-hover:bg-amber-50/75',
    stickyR: 'border-r border-amber-200',
    rowHover: 'hover:bg-amber-50/65',
    pBorder: 'border-t-2 border-b-2 border-amber-400',
    stickyLeft: 'border-l-2 border-l-amber-500',
    stickyRight: 'border-r-2 border-r-amber-500',
    mobileCard: 'border-amber-400 bg-amber-50/45 ring-1 ring-amber-200/30',
    groupTop: 'border-t-2 border-amber-300',
  },
};

const BODY_ROW_STYLE: PinTierStyle = {
  stickyBg: 'bg-white',
  stickyHover: 'group-hover:bg-slate-50/80',
  stickyR: 'border-r border-slate-100/80',
  rowHover: 'hover:bg-slate-50/80',
  pBorder: 'border-b border-slate-100/80',
  stickyLeft: '',
  stickyRight: '',
  mobileCard: 'border-slate-200/60 bg-white hover:border-slate-300',
  groupTop: '',
};

export function inquiryListPinTierStyle(
  row: InquiryListSortable,
): PinTierStyle & { tier: InquiryListPinTier; isPinned: boolean } {
  const tier = inquiryListSortTier(row);
  if (tier === 4) {
    return { tier, isPinned: false, ...BODY_ROW_STYLE };
  }
  return { tier, isPinned: true, ...PIN_TIER_STYLES[tier] };
}

/** 해피콜 행 강조는 본문(tier 4)에서만 */
export function inquiryListRowUsesHappyCallTone(row: InquiryListSortable): boolean {
  return !isInquiryListPinnedPreReceive(row);
}
