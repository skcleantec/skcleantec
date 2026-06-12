/** 업무용 레이아웃(`AdminLayout`·`TeamLayout`·`CrewLayout`)의 스크롤 컨테이너 */
export const STAFF_APP_SCROLL_SELECTOR = 'main.staff-app-surface';

export function getStaffAppScrollElement(): HTMLElement | null {
  return document.querySelector(STAFF_APP_SCROLL_SELECTOR);
}

export function captureStaffAppScrollTop(): number {
  const el = getStaffAppScrollElement();
  if (el) return el.scrollTop;
  return window.scrollY;
}

/** React 페인트 직후에도 위치가 유지되도록 한 프레임 더 적용한다. */
export function restoreStaffAppScrollTop(top: number): void {
  const apply = () => {
    const el = getStaffAppScrollElement();
    if (el) el.scrollTop = top;
    else window.scrollTo(0, top);
  };
  apply();
  requestAnimationFrame(apply);
}

export function scrollStaffAppToTop(): void {
  restoreStaffAppScrollTop(0);
}
