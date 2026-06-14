import { useEffect } from 'react';
import { formatBrowserTabTitle } from '@shared/platformBrand';

/**
 * 테넌트(업체) 표시명 등으로 브라우저 탭 제목을 동적으로 맞춘다.
 * 형식: `청소의시작- {pageLabel}` (pageLabel 없으면 `청소의시작`만)
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    const next = formatBrowserTabTitle(title);
    if (document.title !== next) {
      document.title = next;
    }
  }, [title]);
}
