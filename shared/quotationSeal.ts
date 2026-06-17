/**
 * 견적서 공급자 직인(도장) PNG 권장·표시 크기
 */

/** 원본 PNG 권장 (정사각, 투명 배경) */
export const QUOTATION_SEAL_SOURCE_PX = 200;

/** 화면·PDF 표시 기본 너비(px / PDF pt 동일 스케일) */
export const QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT = 48;

export const QUOTATION_SEAL_DISPLAY_WIDTH_MIN = 32;
export const QUOTATION_SEAL_DISPLAY_WIDTH_MAX = 96;

export function resolveQuotationSealDisplayWidth(raw: number | undefined | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(
      QUOTATION_SEAL_DISPLAY_WIDTH_MAX,
      Math.max(QUOTATION_SEAL_DISPLAY_WIDTH_MIN, Math.round(raw)),
    );
  }
  return QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT;
}
