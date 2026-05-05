/** 관리·C/S 목록 등 한국어 고정 표기용 */

export function formatInquiryAreaKoLine(item: {
  areaBasis?: string | null;
  areaPyeong?: number | null;
  exclusiveAreaSqm?: number | null;
}): string {
  const b = item.areaBasis?.trim();
  const sqm =
    item.exclusiveAreaSqm != null && Number.isFinite(item.exclusiveAreaSqm)
      ? item.exclusiveAreaSqm
      : null;
  const py = item.areaPyeong != null && Number.isFinite(item.areaPyeong) ? item.areaPyeong : null;

  if (b === '공급') {
    if (py == null) return '—';
    return `공급면적 ${py}평 (분양평수)`;
  }
  if (b === '전용') {
    if (sqm != null) {
      const sqStr = Number(sqm).toLocaleString('ko-KR');
      if (py != null) {
        return `전용면적 ${sqStr}㎡ (실제 내 집 공간) · 참고 ${py}평`;
      }
      return `전용면적 ${sqStr}㎡ (실제 내 집 공간)`;
    }
    if (py != null) return `전용면적 ${py}평 (㎡ 미입력)`;
    return '—';
  }
  if (py != null && sqm != null) {
    return `${py}평 · ${Number(sqm).toLocaleString('ko-KR')}㎡`;
  }
  if (py != null) return `${py}평`;
  return '—';
}
