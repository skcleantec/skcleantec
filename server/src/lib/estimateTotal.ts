/** 평수 × 평당 단가 견적. minimumTotalAmount > 0 이면 그 이상으로 보장한다. */
export function computeEstimateTotalFromPyeong(
  pyeong: number,
  pricePerPyeong: number,
  minimumTotalAmount?: number | null,
): number {
  if (!Number.isFinite(pyeong) || pyeong <= 0 || !Number.isFinite(pricePerPyeong) || pricePerPyeong <= 0) {
    return 0;
  }
  const raw = Math.round(pyeong * pricePerPyeong);
  const min = minimumTotalAmount ?? 0;
  if (min > 0) return Math.max(raw, min);
  return raw;
}
