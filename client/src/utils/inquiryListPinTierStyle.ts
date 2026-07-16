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
  /** PC 행·sticky 셀 배경 */
  rowBg: string;
  stickyBg: string;
  stickyHover: string;
  stickyR: string;
  rowHover: string;
  /** 행 구분선 */
  pBorder: string;
  stickyLeft: string;
  stickyRight: string;
  /** 모바일 카드 shell */
  mobileCard: string;
  /** tier 그룹 경계 (첫 행) */
  groupTop: string;
};

const PIN_TIER_STYLES: Record<Exclude<InquiryListPinTier, 4>, PinTierStyle> = {
  0: {
    rowBg: 'bg-rose-50/80',
    stickyBg: 'bg-rose-50/80',
    stickyHover: 'group-hover:bg-rose-100/60',
    stickyR: 'border-r border-rose-100/70',
    rowHover: 'hover:bg-rose-100/50',
    pBorder: 'border-b border-rose-100/70',
    stickyLeft: '',
    stickyRight: '',
    mobileCard: 'border-slate-200/60 bg-rose-50/90 shadow-sm shadow-rose-100/20',
    groupTop: 'border-t border-slate-200/50',
  },
  1: {
    rowBg: 'bg-emerald-50/70',
    stickyBg: 'bg-emerald-50/70',
    stickyHover: 'group-hover:bg-emerald-100/55',
    stickyR: 'border-r border-emerald-100/70',
    rowHover: 'hover:bg-emerald-100/45',
    pBorder: 'border-b border-emerald-100/70',
    stickyLeft: '',
    stickyRight: '',
    mobileCard: 'border-slate-200/60 bg-emerald-50/85 shadow-sm shadow-emerald-100/20',
    groupTop: 'border-t border-slate-200/50',
  },
  2: {
    rowBg: 'bg-sky-50/75',
    stickyBg: 'bg-sky-50/75',
    stickyHover: 'group-hover:bg-sky-100/60',
    stickyR: 'border-r border-sky-100/70',
    rowHover: 'hover:bg-sky-100/50',
    pBorder: 'border-b border-sky-100/70',
    stickyLeft: '',
    stickyRight: '',
    mobileCard: 'border-slate-200/60 bg-sky-50/90 shadow-sm shadow-sky-100/20',
    groupTop: 'border-t border-slate-200/50',
  },
  3: {
    rowBg: 'bg-amber-50/70',
    stickyBg: 'bg-amber-50/70',
    stickyHover: 'group-hover:bg-amber-100/55',
    stickyR: 'border-r border-amber-100/70',
    rowHover: 'hover:bg-amber-100/45',
    pBorder: 'border-b border-amber-100/70',
    stickyLeft: '',
    stickyRight: '',
    mobileCard: 'border-slate-200/60 bg-amber-50/85 shadow-sm shadow-amber-100/20',
    groupTop: 'border-t border-slate-200/50',
  },
};

const BODY_ROW_STYLE: PinTierStyle = {
  rowBg: '',
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
