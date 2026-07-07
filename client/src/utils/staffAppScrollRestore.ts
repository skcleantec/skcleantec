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

/** `main.staff-app-surface` 안에서 요소가 보이도록 스크롤한다. */
export function scrollStaffAppElementIntoView(el: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
  const container = getStaffAppScrollElement();
  if (!container) {
    scrollElementIntoNearestScrollContainer(el, behavior);
    return;
  }
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const top = elRect.top - containerRect.top + container.scrollTop - 12;
  container.scrollTo({ top: Math.max(0, top), behavior });
}

/** 드로어·모달 등 가장 가까운 overflow 스크롤 컨테이너 안에서 요소를 보이게 한다. */
export function scrollElementIntoNearestScrollContainer(
  el: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
  offsetPx = 12,
): void {
  const staffMain = getStaffAppScrollElement();
  let container: HTMLElement | null = el.parentElement;
  while (container) {
    const style = window.getComputedStyle(container);
    const overflowY = style.overflowY;
    const scrollable =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      container.scrollHeight > container.clientHeight + 1;
    if (scrollable) break;
    if (container === staffMain) break;
    container = container.parentElement;
  }
  if (container && container !== document.documentElement && container !== document.body) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - containerRect.top + container.scrollTop - offsetPx;
    container.scrollTo({ top: Math.max(0, top), behavior });
    return;
  }
  el.scrollIntoView({ behavior, block: 'nearest' });
}
