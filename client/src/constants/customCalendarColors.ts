/**
 * 사용자 맞춤 지역 캘린더 탭에 사용하는 색상 팔레트.
 * 탭(휴면/활성) · 날짜 칸 배지 모두 동일 키를 참조한다.
 *
 * 서버 허용 키: `server/src/constants/customCalendarColorKeys.ts` 와 동일 목록 유지.
 */

export const CUSTOM_CALENDAR_COLOR_KEYS = [
  'teal',
  'amber',
  'rose',
  'violet',
  'sky',
  'emerald',
  'slate',
  'cyan',
  'lime',
  'orange',
  'indigo',
  'pink',
  'red',
  'blue',
  'purple',
  'fuchsia',
  'yellow',
  'stone',
  'zinc',
  'neutral',
  'gray',
  'green',
] as const;
export type CustomCalendarColorKey = (typeof CUSTOM_CALENDAR_COLOR_KEYS)[number];

/** 모달·툴팁용 짧은 한글 표기 */
export const CUSTOM_CALENDAR_COLOR_LABEL_KO: Record<CustomCalendarColorKey, string> = {
  teal: '청록',
  amber: '호박',
  rose: '로즈',
  violet: '보라',
  sky: '하늘',
  emerald: '에메',
  slate: '슬레이트',
  cyan: '시안',
  lime: '라임',
  orange: '오렌지',
  indigo: '남색',
  pink: '핑크',
  red: '빨강',
  blue: '파랑',
  purple: '퍼플',
  fuchsia: '자홍',
  yellow: '노랑',
  stone: '스톤',
  zinc: '징크',
  neutral: '뉴트럴',
  gray: '회색',
  green: '초록',
};

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
  cyan: {
    tabIdle: 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100',
    tabActive: 'bg-cyan-600 text-white border-cyan-700',
    badge: 'bg-cyan-50 text-cyan-800 border border-cyan-200',
    dot: 'bg-cyan-500',
  },
  lime: {
    tabIdle: 'bg-lime-50 text-lime-900 border-lime-200 hover:bg-lime-100',
    tabActive: 'bg-lime-600 text-white border-lime-700',
    badge: 'bg-lime-50 text-lime-900 border border-lime-200',
    dot: 'bg-lime-500',
  },
  orange: {
    tabIdle: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100',
    tabActive: 'bg-orange-600 text-white border-orange-700',
    badge: 'bg-orange-50 text-orange-800 border border-orange-200',
    dot: 'bg-orange-500',
  },
  indigo: {
    tabIdle: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100',
    tabActive: 'bg-indigo-600 text-white border-indigo-700',
    badge: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
    dot: 'bg-indigo-500',
  },
  pink: {
    tabIdle: 'bg-pink-50 text-pink-800 border-pink-200 hover:bg-pink-100',
    tabActive: 'bg-pink-600 text-white border-pink-700',
    badge: 'bg-pink-50 text-pink-800 border border-pink-200',
    dot: 'bg-pink-500',
  },
  red: {
    tabIdle: 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100',
    tabActive: 'bg-red-600 text-white border-red-700',
    badge: 'bg-red-50 text-red-800 border border-red-200',
    dot: 'bg-red-500',
  },
  blue: {
    tabIdle: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
    tabActive: 'bg-blue-600 text-white border-blue-700',
    badge: 'bg-blue-50 text-blue-800 border border-blue-200',
    dot: 'bg-blue-500',
  },
  purple: {
    tabIdle: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
    tabActive: 'bg-purple-600 text-white border-purple-700',
    badge: 'bg-purple-50 text-purple-800 border border-purple-200',
    dot: 'bg-purple-500',
  },
  fuchsia: {
    tabIdle: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-100',
    tabActive: 'bg-fuchsia-600 text-white border-fuchsia-700',
    badge: 'bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200',
    dot: 'bg-fuchsia-500',
  },
  yellow: {
    tabIdle: 'bg-yellow-50 text-yellow-900 border-yellow-200 hover:bg-yellow-100',
    tabActive: 'bg-yellow-500 text-yellow-950 border-yellow-600',
    badge: 'bg-yellow-50 text-yellow-900 border border-yellow-200',
    dot: 'bg-yellow-400',
  },
  stone: {
    tabIdle: 'bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200',
    tabActive: 'bg-stone-600 text-white border-stone-700',
    badge: 'bg-stone-100 text-stone-800 border border-stone-300',
    dot: 'bg-stone-500',
  },
  zinc: {
    tabIdle: 'bg-zinc-100 text-zinc-800 border-zinc-300 hover:bg-zinc-200',
    tabActive: 'bg-zinc-700 text-white border-zinc-800',
    badge: 'bg-zinc-100 text-zinc-800 border border-zinc-300',
    dot: 'bg-zinc-500',
  },
  neutral: {
    tabIdle: 'bg-neutral-100 text-neutral-800 border-neutral-300 hover:bg-neutral-200',
    tabActive: 'bg-neutral-700 text-white border-neutral-800',
    badge: 'bg-neutral-100 text-neutral-800 border border-neutral-300',
    dot: 'bg-neutral-500',
  },
  gray: {
    tabIdle: 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200',
    tabActive: 'bg-gray-700 text-white border-gray-800',
    badge: 'bg-gray-100 text-gray-800 border border-gray-300',
    dot: 'bg-gray-500',
  },
  green: {
    tabIdle: 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100',
    tabActive: 'bg-green-600 text-white border-green-700',
    badge: 'bg-green-50 text-green-800 border border-green-200',
    dot: 'bg-green-500',
  },
};

export function customCalendarColorTokens(
  colorKey: string | null | undefined
): CustomCalendarColorTokens {
  const key = (CUSTOM_CALENDAR_COLOR_KEYS as readonly string[]).includes(String(colorKey))
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
