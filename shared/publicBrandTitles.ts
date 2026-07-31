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

/**
 * 고객 링크 메시지 제목 — 1줄은 `composeBrandedOrderFormTitle`, 2줄째 이후는 설정 그대로 유지.
 * (브랜드가 있으면 1줄만 `{brand} 발주서`로 바뀌어 2줄째 문구가 빠지던 문제 방지)
 */
export function composeCustomerLinkMessageTitle(
  brandDisplayName: string | null | undefined,
  formTitleResolved: string,
): string {
  const normalized = formTitleResolved.replace(/\r\n/g, '\n');
  const lineBreak = normalized.indexOf('\n');
  if (lineBreak === -1) {
    return composeBrandedOrderFormTitle(brandDisplayName, normalized);
  }

  const firstLine = normalized.slice(0, lineBreak);
  const rest = normalized.slice(lineBreak + 1);
  const headline = composeBrandedOrderFormTitle(brandDisplayName, firstLine);
  if (!rest.trim()) return headline;
  return `${headline}\n${rest}`;
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
