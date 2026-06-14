/** SaaS 플랫폼(최상위 `/platform`) 브랜드명 */
export const PLATFORM_NAME = '청소비서';

/** 브라우저 탭 제목 접두 — `{BROWSER_TAB_PLATFORM}- {테넌트·페이지명}` */
export const BROWSER_TAB_PLATFORM = '청소의시작';

/** 브라우저 탭 제목 (예: `청소의시작- 청소박사`) */
export function formatBrowserTabTitle(pageLabel: string | null | undefined): string {
  const label = typeof pageLabel === 'string' ? pageLabel.trim() : '';
  if (!label) return BROWSER_TAB_PLATFORM;
  return `${BROWSER_TAB_PLATFORM}- ${label}`;
}

/** 브랜드 영문명 — 로그인·마케팅 표기 */
export const PLATFORM_NAME_EN = 'Clean Assistant';

/** 로그인·헤더 부제 */
export const PLATFORM_TAGLINE = '운영콘솔';
