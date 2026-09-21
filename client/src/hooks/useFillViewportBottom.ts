import { useLayoutEffect, useState, type RefObject } from 'react';

/** 요소 꼭대기부터 창 바닥까지 남은 픽셀. 미리보기 iframe을 한 화면에 맞출 때 쓴다. */
export function useFillViewportBottom(
  ref: RefObject<HTMLElement | null>,
  opts?: { bottomGapPx?: number; minPx?: number; layoutKey?: string | number },
): number | null {
  const bottomGapPx = opts?.bottomGapPx ?? 10;
  const minPx = opts?.minPx ?? 280;
  const layoutKey = opts?.layoutKey;
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const top = el.getBoundingClientRect().top;
      const viewH = window.visualViewport?.height ?? window.innerHeight;
      setHeight(Math.max(minPx, Math.floor(viewH - top - bottomGapPx)));
    };

    apply();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      apply();
      raf2 = requestAnimationFrame(apply);
    });
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    window.addEventListener('resize', apply);
    const ro = new ResizeObserver(apply);
    if (el.parentElement) ro.observe(el.parentElement);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      vv?.removeEventListener('resize', apply);
      window.removeEventListener('resize', apply);
      ro.disconnect();
    };
  }, [bottomGapPx, minPx, layoutKey]);

  return height;
}
