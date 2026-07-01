import { useCallback, useEffect, useRef, useState } from 'react';

/** GNB·하위 탭 가로 스크롤 — overflow 감지·좌우 이동 */
export function useHorizontalNavScroll(hintKey?: string | number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [moreLeft, setMoreLeft] = useState(false);
  const [moreRight, setMoreRight] = useState(false);

  const updateHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollWidth = Math.ceil(el.scrollWidth);
    const clientWidth = Math.floor(el.clientWidth);
    if (clientWidth <= 0) return;
    const scrollLeft = Math.round(el.scrollLeft);
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const hasOverflow = scrollWidth > clientWidth + 1;
    const atStart = scrollLeft <= 2;
    const atEnd = maxScroll <= 2 || scrollLeft >= maxScroll - 2;
    setMoreLeft(hasOverflow && !atStart);
    setMoreRight(hasOverflow && !atEnd);
  }, []);

  useEffect(() => {
    queueMicrotask(() => updateHints());
  }, [hintKey, updateHints]);

  useEffect(() => {
    const el = scrollRef.current;
    const inner = contentRef.current;
    if (!el) return;
    const run = () => updateHints();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    if (inner) ro.observe(inner);
    window.addEventListener('resize', run);
    void document.fonts?.ready?.then(run);
    const t1 = window.setTimeout(run, 100);
    const t2 = window.setTimeout(run, 450);
    el.addEventListener('scrollend', run);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', run);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      el.removeEventListener('scrollend', run);
    };
  }, [updateHints, hintKey]);

  const scrollStep = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 140;
    return Math.min(160, Math.max(80, Math.round(el.clientWidth * 0.45)));
  }, []);

  const scrollByDir = useCallback(
    (dir: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      const next = Math.max(0, el.scrollLeft + dir * scrollStep());
      el.scrollTo({ left: next, behavior: 'smooth' });
      window.setTimeout(updateHints, 400);
    },
    [scrollStep, updateHints],
  );

  return {
    scrollRef,
    contentRef,
    moreLeft,
    moreRight,
    updateHints,
    scrollPrev: () => scrollByDir(-1),
    scrollNext: () => scrollByDir(1),
  };
}
