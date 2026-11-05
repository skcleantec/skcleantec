/**
 * 견적서 공급자 직인(도장) PNG 권장·표시 크기
 */

/** 원본 PNG 권장 (정사각, 투명 배경) */
export const QUOTATION_SEAL_SOURCE_PX = 200;

/** 화면·PDF 표시 기본 너비(px / PDF pt 동일 스케일) */
export const QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT = 72;

export const QUOTATION_SEAL_DISPLAY_WIDTH_MIN = 48;
export const QUOTATION_SEAL_DISPLAY_WIDTH_MAX = 120;

/** 예전 기본·소형 저장값(≤48)은 새 기본 72로 본다 */
const QUOTATION_SEAL_LEGACY_WIDTH_CEILING = 48;

export function resolveQuotationSealDisplayWidth(raw: number | undefined | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const rounded = Math.round(raw);
    if (rounded <= QUOTATION_SEAL_LEGACY_WIDTH_CEILING) {
      return QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT;
    }
    return Math.min(
      QUOTATION_SEAL_DISPLAY_WIDTH_MAX,
      Math.max(QUOTATION_SEAL_DISPLAY_WIDTH_MIN, rounded),
    );
  }
  return QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT;
}
