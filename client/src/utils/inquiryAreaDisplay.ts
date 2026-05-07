/** 관리·C/S 목록 등 한국어 고정 표기용 */

/** 목록·표·요약용 짧은 한 줄 (공급 N평 / 전용 N㎡) */
export function formatInquiryAreaKoShort(item: {
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
    return `공급 ${py}평`;
  }
  if (b === '전용') {
    if (sqm != null) {
      return `전용 ${Number(sqm).toLocaleString('ko-KR')}㎡`;
    }
    if (py != null) return `전용 ${py}평`;
    return '—';
  }
  if (py != null && sqm != null) {
    return `${py}평 · ${Number(sqm).toLocaleString('ko-KR')}㎡`;
  }
  if (py != null) return `${py}평`;
  if (sqm != null) return `${Number(sqm).toLocaleString('ko-KR')}㎡`;
  return '—';
}

/** 편집 폼 문자열 → `formatInquiryAreaKoShort` (복사 텍스트 등) */
export function formatInquiryAreaKoShortFromEditStrings(input: {
  areaBasis: string;
  areaPyeong: string;
  exclusiveAreaSqm: string;
}): string {
  const basis = input.areaBasis.trim();
  const pyStr = input.areaPyeong.trim();
  const sqStr = input.exclusiveAreaSqm.trim();
  const pyParsed = pyStr ? Number.parseFloat(pyStr.replace(/,/g, '')) : NaN;
  const sqParsed = sqStr ? Number.parseFloat(sqStr.replace(/,/g, '')) : NaN;
  const pyNum = Number.isFinite(pyParsed) && pyParsed > 0 ? pyParsed : null;
  const sqNum = Number.isFinite(sqParsed) && sqParsed > 0 ? sqParsed : null;
  return formatInquiryAreaKoShort({
    areaBasis: basis || null,
    areaPyeong: pyNum,
    exclusiveAreaSqm: sqNum,
  });
}

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
