import { useEffect } from 'react';
import { formatBrowserTabTitle } from '@shared/platformBrand';

/**
 * 브라우저 탭 제목 — 항상 `청소의시작 - 청소비서` (업체명 미포함).
 * title 인자는 호출부 호환용이며 탭 제목에는 반영하지 않는다.
 */
export function useDocumentTitle(_title?: string | null): void {
  useEffect(() => {
    const next = formatBrowserTabTitle();
    if (document.title !== next) {
      document.title = next;
    }
  }, []);
}
