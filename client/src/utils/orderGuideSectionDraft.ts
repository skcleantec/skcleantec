/** 안내사항 편집 — 줄바꿈(Enter)을 항목으로 유지 */

export function guideItemsToEditorText(items: string[]): string {
  return items.join('\n');
}

/** `\r\n` · `\n` · `\r` 모두 줄로 나눔. 빈 줄은 편집 중에 유지 */
export function editorTextToGuideItems(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

export function persistGuideItems(items: string[]): string[] {
  return items.map((x) => x.trim()).filter(Boolean);
}

export function sectionDraftFingerprint(section: { title: string; items: string[] }): string {
  return JSON.stringify({
    title: section.title.trim(),
    items: persistGuideItems(section.items),
  });
}
