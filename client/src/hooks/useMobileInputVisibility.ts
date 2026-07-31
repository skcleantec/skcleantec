import { useCallback, useEffect, useRef, type FocusEvent, type RefObject } from 'react';
import { getStaffAppScrollElement } from '../utils/staffAppScrollRestore';

const FIELD_SELECTOR = 'input, textarea, select';

function isFormField(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.matches(FIELD_SELECTOR);
}

/** lg 미만·터치 업무 화면 — PC에서는 키보드 회피 스크롤을 쓰지 않는다 */
export function isMobileKeyboardScrollContext(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(min-width: 1024px)').matches;
}

function focusedFieldFromEvent(e: FocusEvent<HTMLElement>): HTMLElement {
  return isFormField(e.target) ? e.target : e.currentTarget;
}

export type EnsureInputVisibleOptions = {
  /** false면 키보드에 가릴 때만 아래로 스크롤 (위로 당기지 않음) */
  allowScrollUp?: boolean;
};

/** visualViewport·스크롤 컨테이너 기준으로 포커스 필드를 키보드 위에 노출 */
export function ensureInputVisibleAboveKeyboard(
  el: HTMLElement,
  scrollContainer?: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth',
  paddingPx = 20,
  opts?: EnsureInputVisibleOptions,
): void {
  const vv = window.visualViewport;
  const visibleTop = vv ? vv.offsetTop : 0;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const elRect = el.getBoundingClientRect();
  const allowScrollUp = opts?.allowScrollUp !== false;

  const scrollDownBy = elRect.bottom - visibleBottom + paddingPx;
  const scrollUpBy = elRect.top - visibleTop - paddingPx;
  const needScrollDown = scrollDownBy > 0;
  const needScrollUp = allowScrollUp && scrollUpBy < 0;

  if (scrollContainer) {
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    let nextScrollTop = scrollContainer.scrollTop;

    if (needScrollDown) {
      nextScrollTop += scrollDownBy;
    } else if (needScrollUp) {
      nextScrollTop += scrollUpBy;
    }

    nextScrollTop = Math.max(0, Math.min(maxScroll, nextScrollTop));
    if (nextScrollTop !== scrollContainer.scrollTop) {
      scrollContainer.scrollTo({ top: nextScrollTop, behavior });
    }
    return;
  }

  if (needScrollDown) {
    window.scrollBy({ top: scrollDownBy, behavior });
  } else if (needScrollUp) {
    window.scrollBy({ top: scrollUpBy, behavior });
  }
}

function scheduleEnsureVisible(
  el: HTMLElement,
  scrollContainer?: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth',
  opts?: EnsureInputVisibleOptions,
): void {
  const run = () => ensureInputVisibleAboveKeyboard(el, scrollContainer, behavior, 20, opts);
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
}

function restoreStaffAppMainScrollTop(savedTop: number): void {
  const main = getStaffAppScrollElement();
  if (main) main.scrollTop = savedTop;
}

/**
 * 로그인·인증·공개 발주서 등 풀페이지 폼 — 모바일에서만 키보드가 입력칸을 가리지 않게 한다.
 * scrollRef 루트: overflow-y-auto + login-surface.
 * form 또는 scroll wrapper에 onFocusCapture={onFieldFocus} 한 번만 연결 (input마다 onFocus 불필요).
 */
export function useLoginScrollSurface(enabled = isMobileKeyboardScrollContext()): {
  scrollRef: RefObject<HTMLDivElement | null>;
  onFieldFocus: (e: FocusEvent<HTMLElement>) => void;
} {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

  const onFieldFocus = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      if (!enabled) return;
      scheduleEnsureVisible(focusedFieldFromEvent(e), scrollRef.current, 'smooth');
    },
    [enabled],
  );

  return { scrollRef, onFieldFocus };
}

/** 모달·시트 내부 스크롤 — 모바일 키보드가 입력칸을 가리지 않게. scroll div에 modal-form-scroll-surface + onFocusCapture. */
export function useModalScrollKeyboardAvoidance(
  scrollRef: RefObject<HTMLElement | null>,
  enabled = true,
): { onFieldFocus: (e: FocusEvent<HTMLElement>) => void } {
  const mobileEnabled = enabled && isMobileKeyboardScrollContext();

  useEffect(() => {
    if (!mobileEnabled) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const syncKeyboardInset = () => {
      const root = scrollRef.current;
      if (!root) return;
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--modal-keyboard-inset', `${Math.round(overlap)}px`);

      const active = document.activeElement;
      if (isFormField(active)) {
        ensureInputVisibleAboveKeyboard(active, root, 'auto', 24, { allowScrollUp: false });
      }
    };

    vv.addEventListener('resize', syncKeyboardInset);
    vv.addEventListener('scroll', syncKeyboardInset);
    return () => {
      vv.removeEventListener('resize', syncKeyboardInset);
      vv.removeEventListener('scroll', syncKeyboardInset);
      scrollRef.current?.style.removeProperty('--modal-keyboard-inset');
    };
  }, [mobileEnabled, scrollRef]);

  const onFieldFocus = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      if (!mobileEnabled) return;
      scheduleEnsureVisible(focusedFieldFromEvent(e), scrollRef.current, 'smooth', {
        allowScrollUp: false,
      });
    },
    [mobileEnabled, scrollRef],
  );

  return { onFieldFocus };
}

/**
 * 발주서설정 등 staff main + 내부 패널 이중 스크롤 — 모바일/PWA에서만
 * 바깥(main) 스크롤은 고정하고 패널 안에서만 키보드 회피.
 */
export function useStaffAppEditPanelKeyboardAvoidance(
  panelScrollRef: RefObject<HTMLElement | null>,
  enabled = true,
): { onFieldFocus: (e: FocusEvent<HTMLElement>) => void } {
  const mobileEnabled = enabled && isMobileKeyboardScrollContext();
  const pinnedMainScrollTopRef = useRef(0);

  useEffect(() => {
    if (!mobileEnabled) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const syncKeyboardInset = () => {
      const root = panelScrollRef.current;
      if (!root) return;
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--modal-keyboard-inset', `${Math.round(overlap)}px`);

      restoreStaffAppMainScrollTop(pinnedMainScrollTopRef.current);

      const active = document.activeElement;
      if (isFormField(active)) {
        ensureInputVisibleAboveKeyboard(active, root, 'auto', 24, { allowScrollUp: false });
      }
    };

    vv.addEventListener('resize', syncKeyboardInset);
    vv.addEventListener('scroll', syncKeyboardInset);
    return () => {
      vv.removeEventListener('resize', syncKeyboardInset);
      vv.removeEventListener('scroll', syncKeyboardInset);
      panelScrollRef.current?.style.removeProperty('--modal-keyboard-inset');
    };
  }, [mobileEnabled, panelScrollRef]);

  const onFieldFocus = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      if (!mobileEnabled) return;
      const field = focusedFieldFromEvent(e);
      const main = getStaffAppScrollElement();
      if (main) pinnedMainScrollTopRef.current = main.scrollTop;

      scheduleEnsureVisible(field, panelScrollRef.current, 'smooth', { allowScrollUp: false });

      requestAnimationFrame(() => {
        restoreStaffAppMainScrollTop(pinnedMainScrollTopRef.current);
        ensureInputVisibleAboveKeyboard(field, panelScrollRef.current, 'auto', 24, {
          allowScrollUp: false,
        });
      });
    },
    [mobileEnabled, panelScrollRef],
  );

  return { onFieldFocus };
}
