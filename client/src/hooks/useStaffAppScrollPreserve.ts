import { useCallback, useLayoutEffect, useRef, useEffect } from 'react';
import { captureStaffAppScrollTop, restoreStaffAppScrollTop, scrollStaffAppToTop } from '../utils/staffAppScrollRestore';
import { ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT } from '../utils/adminSectionSideNavLayout';

/** 목록 재조회·인라인 수정 후 `main.staff-app-surface` 스크롤 위치를 복원한다. */
export function useStaffAppScrollPreserve() {
  const pendingRef = useRef<number | null>(null);
  /** 사이드 메뉴 접·펼침 등 레이아웃 변경 직후 같은 scrollTop을 한 번 더 맞춘다. */
  const reapplyUntilRef = useRef(0);
  const lastScrollTopRef = useRef<number | null>(null);

  const preserveScroll = useCallback(() => {
    const top = captureStaffAppScrollTop();
    pendingRef.current = top;
    lastScrollTopRef.current = top;
    reapplyUntilRef.current = Date.now() + 450;
  }, []);

  useLayoutEffect(() => {
    if (pendingRef.current === null) return;
    const top = pendingRef.current;
    pendingRef.current = null;
    lastScrollTopRef.current = top;
    restoreStaffAppScrollTop(top);
  });

  useEffect(() => {
    const reapplyAfterLayoutShift = () => {
      if (Date.now() > reapplyUntilRef.current) return;
      if (lastScrollTopRef.current === null) return;
      restoreStaffAppScrollTop(lastScrollTopRef.current);
    };
    window.addEventListener(ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT, reapplyAfterLayoutShift);
    return () => window.removeEventListener(ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT, reapplyAfterLayoutShift);
  }, []);

  return {
    preserveScroll,
    scrollToTop: scrollStaffAppToTop,
  };
}
