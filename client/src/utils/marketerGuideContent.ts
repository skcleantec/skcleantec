export type MarketerGuideChapter = {
  id: string;
  anchor: string;
  title: string;
  desc: string;
};

export const MARKETER_GUIDE_HTML_URL = '/help/marketer-guide.html';
export const MARKETER_GUIDE_TOC_URL = '/help/marketer-guide.toc.json';
export const MARKETER_GUIDE_SCREENSHOTS_URL = '/help/marketer-guide.screenshots.json';

const CHAPTER_ID_PATTERN = /^\d{2}$/;

export function parseMarketerGuideChapter(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || !CHAPTER_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function resolveMarketerGuideChapter(
  raw: string | null,
  chapters: MarketerGuideChapter[],
): string | null {
  const parsed = parseMarketerGuideChapter(raw);
  if (!parsed) return null;
  if (chapters.length === 0) return parsed;
  return chapters.some((c) => c.id === parsed) ? parsed : null;
}

export function marketerGuideIframeSrc(chapterId: string | null, cacheBust?: number): string {
  const chapter = parseMarketerGuideChapter(chapterId);
  const base =
    cacheBust != null && cacheBust > 0
      ? `${MARKETER_GUIDE_HTML_URL}?v=${cacheBust}`
      : MARKETER_GUIDE_HTML_URL;
  if (!chapter) return base;
  return `${base}#slide-${chapter}`;
}

export async function fetchMarketerGuideToc(): Promise<MarketerGuideChapter[]> {
  const res = await fetch(MARKETER_GUIDE_TOC_URL);
  if (!res.ok) throw new Error('관리자 가이드 목차를 불러올 수 없습니다.');
  const data = (await res.json()) as MarketerGuideChapter[];
  if (!Array.isArray(data)) throw new Error('관리자 가이드 목차 형식이 올바르지 않습니다.');
  return data;
}
