import DOMPurify from 'dompurify';

/** 팀장·관리자가 보는 계약 본문 — Quill 출력 기준 허용 제한 후 XSS 방지 */
export function sanitizeEContractHtml(raw: string): string {
  const dirty = (raw ?? '').trim();
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['style', 'class', 'target', 'rel', 'loading', 'width', 'height', 'alt'],
    FORBID_TAGS: ['iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'style', 'script'],
  });
}

export function eContractBodyLooksLikeHtml(body: string): boolean {
  const t = (body ?? '').trim();
  if (!t) return false;
  if (/<[a-z][\s\S]*>/i.test(t)) return true;
  return false;
}
