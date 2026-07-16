import { useEffect } from 'react';
import { formatBrowserTabTitle } from '@shared/platformBrand';

export type UseDocumentTitleOptions = {
  /** 지정 시 기본 탭 제목 대신 사용 (고객 공개 화면 등) */
  tabTitle?: string | null;
};

/**
 * 브라우저 탭 제목 — 기본 `청소의시작 - 청소비서` (업체명 미포함).
 * `options.tabTitle` 이 있으면 해당 문자열을 사용한다.
 * title 인자는 호출부 호환용이며 탭 제목에는 반영하지 않는다.
 */
export function useDocumentTitle(
  _title?: string | null,
  options?: UseDocumentTitleOptions,
): void {
  const tabTitle = options?.tabTitle ?? null;
  useEffect(() => {
    const next = tabTitle?.trim() || formatBrowserTabTitle();
    if (document.title !== next) {
      document.title = next;
    }
  }, [tabTitle]);
}
