import { useEffect } from 'react';

/**
 * 테넌트(업체) 표시명 등으로 브라우저 탭 제목을 동적으로 맞춘다.
 * - title 이 비어 있으면(테넌트 미확정 등) 기존 제목을 건드리지 않는다.
 * - 한 라우트에 한 레이아웃만 마운트되므로 충돌 위험은 낮다.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    const next = typeof title === 'string' ? title.trim() : '';
    if (!next) return;
    if (document.title !== next) {
      document.title = next;
    }
  }, [title]);
}
