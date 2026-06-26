/** 관리·C/S 목록 등 한국어 고정 표기용 */

/** 1평 ≈ 3.305785㎡ (레거시 ㎡만 있는 전용 접수 표시·폼 근사용) */
export const SQM_PER_PYEONG = 3.305785;

export function approxPyeongFromExclusiveSqm(sqm: number): number {
  return Math.round((sqm / SQM_PER_PYEONG) * 100) / 100;
}

/** 접수 편집 폼 초기값 — 전용·고객발주서는 평(`areaPyeong`); 구 ㎡만 있으면 근사 평으로 채움 */
export function inquiryAreaEditFormStringsFromItem(item: {
  areaBasis?: string | null;
  areaPyeong?: number | null;
  exclusiveAreaSqm?: number | null;
}): { areaPyeong: string; exclusiveAreaSqm: string } {
  const basis = item.areaBasis?.trim() ?? '';
  let areaPyeongStr = item.areaPyeong != null ? String(item.areaPyeong) : '';
  const exclusiveSqmLegacy =
    basis !== '공급' && basis !== '전용' && item.exclusiveAreaSqm != null
      ? String(item.exclusiveAreaSqm)
      : '';
  if (
    basis === '전용' &&
    areaPyeongStr === '' &&
    item.exclusiveAreaSqm != null &&
    Number.isFinite(item.exclusiveAreaSqm)
  ) {
    areaPyeongStr = String(approxPyeongFromExclusiveSqm(item.exclusiveAreaSqm));
  }
  return { areaPyeong: areaPyeongStr, exclusiveAreaSqm: exclusiveSqmLegacy };
}

/** 목록·표·요약용 짧은 한 줄 (공급·전용 모두 평 우선; 구 방식 ㎡만 있으면 근사 평) */
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
    if (py != null) return `전용 ${py}평`;
    if (sqm != null) {
      const approx = approxPyeongFromExclusiveSqm(sqm);
      return `전용 약 ${Number(approx).toLocaleString('ko-KR')}평`;
    }
    return '—';
  }
  if (py != null && sqm != null) {
    return `${py}평 · ${Number(sqm).toLocaleString('ko-KR')}㎡`;
  }
  if (py != null) return `${py}평`;
  if (sqm != null) return `${Number(sqm).toLocaleString('ko-KR')}㎡`;
  return '—';
}

/** 목록·스케줄 카드용 — 면적 + 원룸(또는 SK 원/투룸) 표시 */
export function formatInquiryListAreaLabel(
  item: {
    areaBasis?: string | null;
    areaPyeong?: number | null;
    exclusiveAreaSqm?: number | null;
    isOneRoom?: boolean | null;
  },
  opts?: { oneRoomLabel?: string },
): string {
  const oneRoomLabel = opts?.oneRoomLabel ?? '원룸';
  const base = formatInquiryAreaKoShort(item);
  if (!item.isOneRoom) return base;
  if (base === '—') return oneRoomLabel;
  return `${base}·${oneRoomLabel}`;
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
  if (basis === '공급' || basis === '전용') {
    return formatInquiryAreaKoShort({
      areaBasis: basis,
      areaPyeong: pyNum,
      exclusiveAreaSqm: null,
    });
  }
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
    if (py != null) return `전용면적 ${py}평 (실제 내 집 공간)`;
    if (sqm != null) {
      const approx = approxPyeongFromExclusiveSqm(sqm);
      return `전용면적 약 ${Number(approx).toLocaleString('ko-KR')}평 (구 ㎡ 입력·근사)`;
    }
    return '—';
  }
  if (py != null && sqm != null) {
    return `${py}평 · ${Number(sqm).toLocaleString('ko-KR')}㎡`;
  }
  if (py != null) return `${py}평`;
  return '—';
}
