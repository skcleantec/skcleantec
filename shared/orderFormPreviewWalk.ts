/**
 * 발주서 양식·발주서설정 iframe 미리보기.
 * 손님 실제 토큰에는 절대 적용하지 않는다 — 디자이너 미리보기 토큰 + previewWalk=1 만.
 */
export const DESIGNER_PREVIEW_TOKEN_PREFIX = 'skct_designer_preview';
export const ORDER_FORM_PREVIEW_WALK_QUERY = 'previewWalk';
export const ORDER_FORM_PREVIEW_TEMPLATE_QUERY = 'previewTemplateId';

export function isDesignerPreviewOrderToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.startsWith(DESIGNER_PREVIEW_TOKEN_PREFIX);
}

export function isOrderFormPreviewWalkEnabled(
  token: string | null | undefined,
  search: string | null | undefined,
): boolean {
  if (!isDesignerPreviewOrderToken(token)) return false;
  const raw = (search ?? '').startsWith('?') ? (search ?? '').slice(1) : (search ?? '');
  return new URLSearchParams(raw).get(ORDER_FORM_PREVIEW_WALK_QUERY) === '1';
}

export function readOrderFormPreviewTemplateId(search: string | null | undefined): string | null {
  const raw = (search ?? '').startsWith('?') ? (search ?? '').slice(1) : (search ?? '');
  const id = new URLSearchParams(raw).get(ORDER_FORM_PREVIEW_TEMPLATE_QUERY)?.trim();
  return id || null;
}

/** 공개 URL에 미리보기 걷기 쿼리 추가 */
export function withOrderFormPreviewWalkQuery(
  url: string,
  opts?: { previewTemplateId?: string | null },
): string {
  const sep = url.includes('?') ? '&' : '?';
  let out = `${url}${sep}${ORDER_FORM_PREVIEW_WALK_QUERY}=1`;
  const tid = opts?.previewTemplateId?.trim();
  if (tid) out += `&${ORDER_FORM_PREVIEW_TEMPLATE_QUERY}=${encodeURIComponent(tid)}`;
  return out;
}
