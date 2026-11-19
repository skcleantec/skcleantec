/** 견적 도우미 — 면적 환산. 1평 = 3.305785㎡. 화면 표시는 소수 1자리. */

export const SQM_PER_PYEONG = 3.305785;

/** 종류별 전용률 (공급 대비 전용). 한 곳에서만 둔다. */
export const QUOTE_EXCLUSIVE_RATIOS = {
  apartment: 0.76,
  mixed: 0.7,
  officetel: 0.53,
} as const;

export type QuoteAreaBuildingKind = keyof typeof QUOTE_EXCLUSIVE_RATIOS;

export const QUOTE_AREA_BUILDING_LABELS: Record<QuoteAreaBuildingKind, string> = {
  apartment: '아파트',
  mixed: '주상복합',
  officetel: '오피스텔',
};

export function roundArea1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function sqmToPyeong(sqm: number): number {
  return roundArea1(sqm / SQM_PER_PYEONG);
}

export function pyeongToSqm(pyeong: number): number {
  return roundArea1(pyeong * SQM_PER_PYEONG);
}

/** 전용 ㎡ → 공급 ㎡ (전용 ÷ 전용률) */
export function exclusiveSqmToSupplySqm(exclusiveSqm: number, ratio: number): number {
  if (!(ratio > 0)) return roundArea1(exclusiveSqm);
  return roundArea1(exclusiveSqm / ratio);
}

/** 공급 ㎡ → 전용 ㎡ (공급 × 전용률) */
export function supplySqmToExclusiveSqm(supplySqm: number, ratio: number): number {
  return roundArea1(supplySqm * ratio);
}

/** 입력칸의 숫자만. "15" → 150,000원. 0·빈 값은 없음. */
export function manwonDigitsToWon(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const manwon = Number(digits);
  if (!Number.isFinite(manwon) || manwon <= 0) return null;
  return Math.round(manwon) * 10_000;
}

export function formatArea1(n: number): string {
  const rounded = roundArea1(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
