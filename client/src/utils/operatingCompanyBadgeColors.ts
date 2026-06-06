import {
  OPERATING_COMPANY_BADGE_COLOR_KEYS,
  type OperatingCompanyBadgeColorKey,
} from '../../../shared/operatingCompanyConfig';

export { OPERATING_COMPANY_BADGE_COLOR_KEYS, type OperatingCompanyBadgeColorKey };

const PALETTE: Record<
  OperatingCompanyBadgeColorKey,
  { bg: string; text: string; ring: string; swatch: string }
> = {
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-900',
    ring: 'ring-indigo-200/80',
    swatch: 'bg-indigo-500',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    ring: 'ring-emerald-200/80',
    swatch: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    ring: 'ring-amber-200/80',
    swatch: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-900',
    ring: 'ring-rose-200/80',
    swatch: 'bg-rose-500',
  },
  sky: {
    bg: 'bg-sky-50',
    text: 'text-sky-900',
    ring: 'ring-sky-200/80',
    swatch: 'bg-sky-500',
  },
  violet: {
    bg: 'bg-violet-50',
    text: 'text-violet-900',
    ring: 'ring-violet-200/80',
    swatch: 'bg-violet-500',
  },
  teal: {
    bg: 'bg-teal-50',
    text: 'text-teal-900',
    ring: 'ring-teal-200/80',
    swatch: 'bg-teal-500',
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-900',
    ring: 'ring-orange-200/80',
    swatch: 'bg-orange-500',
  },
  fuchsia: {
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-900',
    ring: 'ring-fuchsia-200/80',
    swatch: 'bg-fuchsia-500',
  },
  cyan: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-900',
    ring: 'ring-cyan-200/80',
    swatch: 'bg-cyan-500',
  },
};

const PALETTE_LIST = OPERATING_COMPANY_BADGE_COLOR_KEYS.map((key) => ({ key, ...PALETTE[key] }));

function stablePaletteIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) >>> 0;
  }
  return h % PALETTE_LIST.length;
}

export function isOperatingCompanyBadgeColorKey(
  value: string | null | undefined,
): value is OperatingCompanyBadgeColorKey {
  return !!value && (OPERATING_COMPANY_BADGE_COLOR_KEYS as readonly string[]).includes(value);
}

export function operatingCompanyBadgeColorOptions() {
  return PALETTE_LIST;
}

export function operatingCompanyBadgeColorClasses(input: {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  badgeColorKey?: string | null;
  inactive?: boolean;
}): string {
  if (input.inactive) {
    return 'bg-gray-100 text-gray-500 line-through ring-1 ring-inset ring-gray-200/80';
  }
  if (isOperatingCompanyBadgeColorKey(input.badgeColorKey)) {
    const { bg, text, ring } = PALETTE[input.badgeColorKey];
    return `${bg} ${text} ring-1 ring-inset ${ring}`;
  }
  const key = (input.id ?? input.slug ?? input.name ?? '').trim().toLowerCase();
  if (!key) {
    return 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200/80';
  }
  const { bg, text, ring } = PALETTE_LIST[stablePaletteIndex(key)];
  return `${bg} ${text} ring-1 ring-inset ${ring}`;
}
