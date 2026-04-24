/**
 * 사용자 맞춤 지역 캘린더 탭에 사용하는 색상 팔레트.
 * 탭(휴면/활성) · 날짜 칸 배지 모두 동일 키를 참조한다.
 */

export const CUSTOM_CALENDAR_COLOR_KEYS = [
  'teal',
  'amber',
  'rose',
  'violet',
  'sky',
  'emerald',
  'slate',
] as const;
export type CustomCalendarColorKey = (typeof CUSTOM_CALENDAR_COLOR_KEYS)[number];

export interface CustomCalendarColorTokens {
  /** 비활성 탭: bg + text + border 클래스 모음 */
  tabIdle: string;
  /** 활성 탭: 진한 배경 + 흰 글씨 */
  tabActive: string;
  /** 날짜 칸 배지: 옅은 배경 + 진한 글씨 */
  badge: string;
  /** 점 표시 (모바일) */
  dot: string;
}

const PALETTE: Record<CustomCalendarColorKey, CustomCalendarColorTokens> = {
  teal: {
    tabIdle: 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100',
    tabActive: 'bg-teal-600 text-white border-teal-700',
    badge: 'bg-teal-50 text-teal-800 border border-teal-200',
    dot: 'bg-teal-500',
  },
  amber: {
    tabIdle: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
    tabActive: 'bg-amber-600 text-white border-amber-700',
    badge: 'bg-amber-50 text-amber-800 border border-amber-200',
    dot: 'bg-amber-500',
  },
  rose: {
    tabIdle: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
    tabActive: 'bg-rose-600 text-white border-rose-700',
    badge: 'bg-rose-50 text-rose-800 border border-rose-200',
    dot: 'bg-rose-500',
  },
  violet: {
    tabIdle: 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100',
    tabActive: 'bg-violet-600 text-white border-violet-700',
    badge: 'bg-violet-50 text-violet-800 border border-violet-200',
    dot: 'bg-violet-500',
  },
  sky: {
    tabIdle: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100',
    tabActive: 'bg-sky-600 text-white border-sky-700',
    badge: 'bg-sky-50 text-sky-800 border border-sky-200',
    dot: 'bg-sky-500',
  },
  emerald: {
    tabIdle: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    tabActive: 'bg-emerald-600 text-white border-emerald-700',
    badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    dot: 'bg-emerald-500',
  },
  slate: {
    tabIdle: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200',
    tabActive: 'bg-slate-700 text-white border-slate-800',
    badge: 'bg-slate-100 text-slate-800 border border-slate-300',
    dot: 'bg-slate-500',
  },
};

export function customCalendarColorTokens(
  colorKey: string | null | undefined
): CustomCalendarColorTokens {
  const key = (CUSTOM_CALENDAR_COLOR_KEYS as readonly string[]).includes(
    String(colorKey)
  )
    ? (colorKey as CustomCalendarColorKey)
    : 'teal';
  return PALETTE[key];
}

/** 새로 만들 때 자동 배정할 색상 — 기존 탭에 쓰인 색을 최대한 피함 */
export function pickAutoColorKey(used: readonly string[]): CustomCalendarColorKey {
  for (const k of CUSTOM_CALENDAR_COLOR_KEYS) {
    if (!used.includes(k)) return k;
  }
  return CUSTOM_CALENDAR_COLOR_KEYS[used.length % CUSTOM_CALENDAR_COLOR_KEYS.length];
}
