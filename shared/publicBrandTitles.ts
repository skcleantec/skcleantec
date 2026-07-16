/** 고객 공개 화면·메시지 — 브랜드 displayName + surface 접미사 (단일 소스) */

export const DEFAULT_PUBLIC_ORDER_FORM_TITLE = '입주청소 발주서';
export const DEFAULT_PUBLIC_CS_TITLE = '고객만족센터';

/** 고객 발주서(`/order/:token`) 브라우저 탭 제목 */
export const CUSTOMER_ORDER_FORM_BROWSER_TAB_TITLE = '고객관리 플랫폼 - 청소비서';

/** 공개 발주서 h1·고객 메시지 첫 줄 — 브랜드·양식명 조합 */
export function composeBrandedOrderFormTitle(
  brandDisplayName?: string | null,
  formTitleFallback?: string | null,
  opts?: { templateTitle?: string | null; isDefaultTemplate?: boolean },
): string {
  const brand = brandDisplayName?.trim();
  const templateTitle = opts?.templateTitle?.trim();
  const isDefaultTemplate = opts?.isDefaultTemplate ?? true;
  if (brand) {
    if (templateTitle && !isDefaultTemplate) return `${brand} ${templateTitle}`;
    return `${brand} 발주서`;
  }
  if (templateTitle && !isDefaultTemplate) return templateTitle;
  const fallback = formTitleFallback?.trim();
  return fallback || DEFAULT_PUBLIC_ORDER_FORM_TITLE;
}

/** `/cs` 헤더·탭 제목 — `{brand} C/S` */
export function composeBrandedCsTitle(brandDisplayName?: string | null): string {
  const brand = brandDisplayName?.trim();
  if (brand) return `${brand} C/S`;
  return DEFAULT_PUBLIC_CS_TITLE;
}

/** 고객 메시지 C/S URL 라벨 — 브랜드 있으면 `{brand} C/S`, 없으면 설정값·기본 */
export function composeBrandedCsUrlLabel(
  brandDisplayName?: string | null,
  configuredLabel?: string | null,
): string {
  const brand = brandDisplayName?.trim();
  if (brand) return `${brand} C/S`;
  const custom = configuredLabel?.trim();
  return custom || '신고 URL:';
}
