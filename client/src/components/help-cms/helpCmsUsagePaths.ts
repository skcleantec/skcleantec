/** /help 사용법 CMS — 쿼리 한 번에 맞추는 경로 */

export function helpUsageHomePath(): string {
  /** category 생략 시 HelpPage 기본이 usage — 첫 화면(검색·누구세요) */
  return '/help';
}

export function helpUsageSectionPath(section: string): string {
  const sp = new URLSearchParams();
  sp.set('category', 'usage');
  sp.set('section', section);
  return `/help?${sp.toString()}`;
}

export function helpUsageArticlePath(section: string, article: string): string {
  const sp = new URLSearchParams();
  sp.set('category', 'usage');
  sp.set('section', section);
  sp.set('article', article);
  return `/help?${sp.toString()}`;
}

export function helpUsageSearchPath(q: string): string {
  const sp = new URLSearchParams();
  sp.set('category', 'usage');
  sp.set('q', q.trim());
  return `/help?${sp.toString()}`;
}
