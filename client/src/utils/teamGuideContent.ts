export type TeamGuideChapter = {
  id: string;
  anchor: string;
  title: string;
  desc: string;
};

export const TEAM_GUIDE_HTML_URL = '/help/team-guide.html';
export const TEAM_GUIDE_TOC_URL = '/help/team-guide.toc.json';

const CHAPTER_ID_PATTERN = /^(0[1-9]|10)$/;

export function parseTeamGuideChapter(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;
  return CHAPTER_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function teamGuideIframeSrc(chapterId: string | null): string {
  const chapter = parseTeamGuideChapter(chapterId);
  if (!chapter) return TEAM_GUIDE_HTML_URL;
  return `${TEAM_GUIDE_HTML_URL}#slide-${chapter}`;
}

export async function fetchTeamGuideToc(): Promise<TeamGuideChapter[]> {
  const res = await fetch(TEAM_GUIDE_TOC_URL);
  if (!res.ok) throw new Error('팀장 가이드 목차를 불러올 수 없습니다.');
  const data = (await res.json()) as TeamGuideChapter[];
  if (!Array.isArray(data)) throw new Error('팀장 가이드 목차 형식이 올바르지 않습니다.');
  return data;
}
