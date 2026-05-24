/** TipTap/Quill HTML·플레이스홀더 기준 — 배포 가능한 본문인지 */
export function editorBodyHasMeaningfulContent(body: string): boolean {
  const raw = (body ?? '').replace(/\r\n/g, '\n').trim();
  if (!raw) return false;
  if (/\[\[EC_[^\]]+\]\]/.test(raw)) return true;
  if (/<table\b/i.test(raw)) return true;
  if (/<img\b/i.test(raw)) return true;

  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
  return text.length > 0;
}

/** 배포본 HTML에서 부록을 뺀 본문이 비어 있는지 */
export function publishedMainBodyIsEmpty(html: string): boolean {
  return !editorBodyHasMeaningfulContent(html);
}
