import DOMPurify from 'dompurify';
import { parseOrderFormModalTextMarkup } from '@shared/orderFormModalTextMarkup';

/** 발주서 모달 문구 — 마크업 파싱 후 XSS 방지 */
export function orderFormModalTextToSafeHtml(raw: string): string {
  const parsed = parseOrderFormModalTextMarkup(raw ?? '');
  if (!parsed.trim()) return '';
  return DOMPurify.sanitize(parsed, {
    ALLOWED_TAGS: ['strong', 'span', 'br'],
    ALLOWED_ATTR: ['style'],
  });
}
