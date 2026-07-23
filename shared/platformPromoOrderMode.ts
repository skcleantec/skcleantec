export const PLATFORM_PROMO_ORDER_MODES = ['FIXED', 'RANDOM'] as const;
export type PlatformPromoOrderMode = (typeof PLATFORM_PROMO_ORDER_MODES)[number];

export const PLATFORM_PROMO_ORDER_MODE_OVERRIDES = ['INHERIT', 'FIXED', 'RANDOM'] as const;
export type PlatformPromoOrderModeOverride = (typeof PLATFORM_PROMO_ORDER_MODE_OVERRIDES)[number];

export const PLATFORM_PROMO_ORDER_MODE_LABELS: Record<PlatformPromoOrderMode, string> = {
  FIXED: '고정순서',
  RANDOM: '랜덤',
};

export const PLATFORM_PROMO_ORDER_MODE_OVERRIDE_LABELS: Record<PlatformPromoOrderModeOverride, string> = {
  INHERIT: '기본 따름',
  FIXED: '고정순서',
  RANDOM: '랜덤',
};

export function parsePlatformPromoOrderMode(raw: unknown): PlatformPromoOrderMode | null {
  if (raw === 'FIXED' || raw === 'RANDOM') return raw;
  return null;
}

export function parsePlatformPromoOrderModeOverride(raw: unknown): PlatformPromoOrderModeOverride | null {
  if (raw === 'INHERIT' || raw === 'FIXED' || raw === 'RANDOM') return raw;
  return null;
}
