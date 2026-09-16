import { helpCmsMarkdownToHtml } from './helpCmsMarkdownToHtml';

/** 파일에서 복사한 완성 HTML 문서(소스)인지 — 브라우저 렌더 복사와 구분 */
export function looksLikeFullHtmlDocumentSource(text: string): boolean {
  const t = String(text ?? '').trim();
  if (!t) return false;
  if (/<!DOCTYPE\s+html/i.test(t)) return true;
  if (/<html[\s>]/i.test(t) && /<(head|body|style|table|div)\b/i.test(t)) return true;
  if (/<style[\s>]/i.test(t) && /<(body|div|table|section|article)\b/i.test(t)) return true;
  return false;
}

/** 클립보드 평문이 HTML 소스처럼 보일 때 (태그까지 복사한 경우) */
export function looksLikeHtmlSourceForPaste(text: string): boolean {
  const t = text.trim();
  if (looksLikeFullHtmlDocumentSource(t)) return true;
  if (/^<!DOCTYPE|^<html[\s>]|^<head[\s>]|^<body[\s>]|^<style[\s>]|^<meta[\s>]/i.test(t)) return true;
  if (/<(table|td|th|colgroup|thead|tbody)\b/i.test(t)) return true;
  return /^<(p|h[1-6]|div|table|ul|ol|blockquote|hr|section|article|strong|em|br|figure|span)\b/i.test(t);
}

/** 채팅·가이드에서 복사한 마크다운인지 */
export function looksLikeMarkdownForPaste(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^#{1,3}\s/m.test(t)) return true;
  if (/^\|.*\|$/m.test(t) && /\|[\s\-:|]+\|/.test(t)) return true;
  if (/^\s*[-*]\s+\S/m.test(t)) return true;
  if (/^\s*\d+\.\s+\S/m.test(t)) return true;
  if (/\*\*[^*]+\*\*/.test(t)) return true;
  if (/^>\s/m.test(t)) return true;
  return false;
}

/** 붙여넣을 평문 → 에디터 HTML. 해당 없으면 null (기본 붙여넣기). */
export function structuredHtmlFromPlainPaste(text: string): string | null {
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return null;
  if (looksLikeHtmlSourceForPaste(trimmed)) return trimmed;
  if (looksLikeMarkdownForPaste(trimmed)) return helpCmsMarkdownToHtml(trimmed);
  return null;
}
