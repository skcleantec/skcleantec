/** 견적서·업체등록정보 공통 직인 필드 */
export type QuotationSealFields = {
  sealPublicId?: string;
  sealSecureUrl?: string;
  /** 화면·PDF 표시 너비 (px / pt). 기본 48 */
  sealDisplayWidthPx?: number;
};

export type QuotationSealClearPatch = {
  sealPublicId?: string | null;
  sealSecureUrl?: string | null;
  sealDisplayWidthPx?: number | null;
};
