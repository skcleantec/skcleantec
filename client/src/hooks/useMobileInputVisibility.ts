import { useCallback, useEffect, useRef, type FocusEvent, type RefObject } from 'react';

const FIELD_SELECTOR = 'input, textarea, select';

function isFormField(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.matches(FIELD_SELECTOR);
}

/** visualViewport·스크롤 컨테이너 기준으로 포커스 필드를 키보드 위에 노출 */
export function ensureInputVisibleAboveKeyboard(
  el: HTMLElement,
  scrollContainer?: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth',
  paddingPx = 20,
): void {
  const vv = window.visualViewport;
  const visibleTop = vv ? vv.offsetTop : 0;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const elRect = el.getBoundingClientRect();

  if (scrollContainer) {
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    let nextScrollTop = scrollContainer.scrollTop;

    if (elRect.bottom > visibleBottom - paddingPx) {
      nextScrollTop += elRect.bottom - visibleBottom + paddingPx;
    } else if (elRect.top < visibleTop + paddingPx) {
      nextScrollTop += elRect.top - visibleTop - paddingPx;
    }

    nextScrollTop = Math.max(0, Math.min(maxScroll, nextScrollTop));
    if (nextScrollTop !== scrollContainer.scrollTop) {
      scrollContainer.scrollTo({ top: nextScrollTop, behavior });
    }
    return;
  }

  if (elRect.bottom > visibleBottom - paddingPx) {
    window.scrollBy({ top: elRect.bottom - visibleBottom + paddingPx, behavior });
  } else if (elRect.top < visibleTop + paddingPx) {
    window.scrollBy({ top: elRect.top - visibleTop - paddingPx, behavior });
  }
}

function scheduleEnsureVisible(
  el: HTMLElement,
  scrollContainer?: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth',
): void {
  const run = () => ensureInputVisibleAboveKeyboard(el, scrollContainer, behavior);
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
}

/**
 * 로그인·인증 등 풀페이지 폼 — 모바일 키보드가 입력칸을 가리지 않게 한다.
 * scrollRef 루트에 overflow-y-auto + login-surface 클래스를 둔다.
 */
export function useLoginScrollSurface(): {
  scrollRef: RefObject<HTMLDivElement | null>;
  onFieldFocus: (e: FocusEvent<HTMLElement>) => void;
} {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const syncKeyboardInset = () => {
      const root = scrollRef.current;
      if (!root) return;
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--login-keyboard-inset', `${Math.round(overlap)}px`);

      const active = document.activeElement;
      if (isFormField(active)) {
        ensureInputVisibleAboveKeyboard(active, root, 'auto');
      }
    };

    vv.addEventListener('resize', syncKeyboardInset);
    vv.addEventListener('scroll', syncKeyboardInset);
    return () => {
      vv.removeEventListener('resize', syncKeyboardInset);
      vv.removeEventListener('scroll', syncKeyboardInset);
      scrollRef.current?.style.removeProperty('--login-keyboard-inset');
    };
  }, []);

  const onFieldFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    scheduleEnsureVisible(e.currentTarget, scrollRef.current, 'smooth');
  }, []);

  return { scrollRef, onFieldFocus };
}
