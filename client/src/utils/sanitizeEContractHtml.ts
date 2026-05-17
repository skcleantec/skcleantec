import DOMPurify from 'dompurify';

/**
 * 서버 `eContractBodyParagraphStabilize.ts` 와 동일 규칙 — 빈 `<p></p>` 는 줄바꿈이 보이도록 `<br />` 보강.
 */
export function stabilizeEContractParagraphHtml(html: string): string {
  return (html ?? '').replace(/<p\b([^>]*)>\s*<\/p>/gi, '<p$1><br /></p>');
}

/** 팀장·관리자가 보는 계약 본문 — Quill 출력 기준 허용 제한 후 XSS 방지 */
export function sanitizeEContractHtml(raw: string): string {
  const dirty = (raw ?? '').trim();
  if (!dirty) return '';
  return DOMPurify.sanitize(stabilizeEContractParagraphHtml(dirty), {
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
