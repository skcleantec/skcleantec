/**
 * TipTap(ProseMirror) 등으로 저장된 빈 단락 `<p></p>` 는 브라우저에서 높이가 0이 되어 줄바꿈이 안 보입니다.
 * 계약 표시본·저장본에 일관되게 한 줄 높이를 만들기 위해 빈 블록에 `<br />` 를 보강합니다.
 * 클라이언트: `client/src/utils/sanitizeEContractHtml.ts` 의 `stabilizeEContractParagraphHtml` 과 동일 규칙 유지.
 */
export function stabilizeEContractParagraphHtml(html: string): string {
  return (html ?? '').replace(/<p\b([^>]*)>\s*<\/p>/gi, '<p$1><br /></p>');
}
