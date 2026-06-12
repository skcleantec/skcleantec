import { useCallback, useLayoutEffect, useRef } from 'react';
import { captureStaffAppScrollTop, restoreStaffAppScrollTop, scrollStaffAppToTop } from '../utils/staffAppScrollRestore';

/** 목록 재조회·인라인 수정 후 `main.staff-app-surface` 스크롤 위치를 복원한다. */
export function useStaffAppScrollPreserve() {
  const pendingRef = useRef<number | null>(null);

  const preserveScroll = useCallback(() => {
    pendingRef.current = captureStaffAppScrollTop();
  }, []);

  useLayoutEffect(() => {
    if (pendingRef.current === null) return;
    const top = pendingRef.current;
    pendingRef.current = null;
    restoreStaffAppScrollTop(top);
  });

  return {
    preserveScroll,
    scrollToTop: scrollStaffAppToTop,
  };
}
