import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { fetchTeamLeaderTrainingImageBlob } from '../../api/teamLeaderTraining';
import { LineMdIcon } from '../ui/LineMdIcon';

type Slide = { index: number; title: string };

const MIN_SCALE = 1;
const MAX_SCALE = 5;

type GestureMode = 'idle' | 'undecided' | 'pan' | 'pinch' | 'swipe';

type Gesture = {
  scale: number;
  x: number;
  y: number;
  dragX: number;
  mode: GestureMode;
  pinchStartDist: number;
  pinchStartScale: number;
  downX: number;
  downY: number;
  panStartX: number;
  panStartY: number;
  panOriginX: number;
  panOriginY: number;
  moved: boolean;
  lastTap: number;
};

type Box = { w: number; h: number };

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const SAFE_SCREEN: CSSProperties = {
  paddingTop: 'max(env(safe-area-inset-top, 0px), var(--cbiseo-safe-area-top, 0px))',
  paddingRight: 'max(env(safe-area-inset-right, 0px), var(--cbiseo-safe-area-right, 0px))',
  paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--cbiseo-safe-area-bottom, 0px))',
  paddingLeft: 'max(env(safe-area-inset-left, 0px), var(--cbiseo-safe-area-left, 0px))',
};

export function SkTeamTrainingSlideViewer({
  token,
  items,
  onClose,
}: {
  token: string;
  items: Slide[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<Gesture>({
    scale: 1,
    x: 0,
    y: 0,
    dragX: 0,
    mode: 'idle',
    pinchStartDist: 0,
    pinchStartScale: 1,
    downX: 0,
    downY: 0,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    moved: false,
    lastTap: 0,
  });
  const indexRef = useRef(index);
  indexRef.current = index;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const paint = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const g = gesture.current;
    img.style.transform = `translate(calc(-50% + ${g.x + g.dragX}px), calc(-50% + ${g.y}px)) scale(${g.scale})`;
  }, []);

  const clampPan = useCallback(() => {
    const view = viewRef.current;
    const img = imgRef.current;
    if (!view || !img) return;
    const g = gesture.current;
    const maxX = Math.max(0, (img.offsetWidth * g.scale - view.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * g.scale - view.clientHeight) / 2);
    g.x = Math.min(maxX, Math.max(-maxX, g.x));
    g.y = Math.min(maxY, Math.max(-maxY, g.y));
  }, []);

  const fitContain = useCallback(() => {
    const view = viewRef.current;
    const img = imgRef.current;
    const g = gesture.current;
    g.scale = 1;
    g.x = 0;
    g.y = 0;
    g.dragX = 0;
    if (!view || !img || !img.naturalWidth || !img.naturalHeight) {
      paint();
      return;
    }
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    if (vw < 2 || vh < 2) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const viewRatio = vw / vh;
    const w = ratio > viewRatio ? vw : vh * ratio;
    const h = ratio > viewRatio ? vw / ratio : vh;
    setBox((prev) => (prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
    paint();
  }, [paint]);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length || next === indexRef.current) return;
      gesture.current.mode = 'idle';
      gesture.current.scale = 1;
      gesture.current.x = 0;
      gesture.current.y = 0;
      gesture.current.dragX = 0;
      setBox(null);
      setSrc(cacheRef.current.get(next) ?? null);
      setFailed(false);
      setIndex(next);
    },
    [items.length],
  );

  useEffect(() => {
    shellRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    history.pushState({ skTeamTrainingViewer: 1 }, '');
    let closedByHistory = false;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (gesture.current.scale > 1.01) return;
      if (event.key === 'ArrowRight') go(indexRef.current + 1);
      if (event.key === 'ArrowLeft') go(indexRef.current - 1);
    };
    const onPop = () => {
      closedByHistory = true;
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      const state = history.state as { skTeamTrainingViewer?: number } | null;
      if (!closedByHistory && state?.skTeamTrainingViewer) history.back();
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
    };
  }, [go]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const block = (event: TouchEvent) => event.preventDefault();
    el.addEventListener('touchmove', block, { passive: false });
    const observer = new ResizeObserver(() => fitContain());
    observer.observe(el);
    return () => {
      el.removeEventListener('touchmove', block);
      observer.disconnect();
    };
  }, [fitContain]);

  useEffect(() => {
    paint();
  }, [box, index, paint]);

  useEffect(() => {
    let cancel = false;
    const want = [index - 1, index, index + 1].filter((i) => i >= 0 && i < items.length);
    for (const i of want) {
      const cached = cacheRef.current.get(i);
      if (cached) {
        if (i === index) setSrc(cached);
        continue;
      }
      void fetchTeamLeaderTrainingImageBlob(token, items[i].index)
        .then((blob) => {
          if (cancel) return;
          const url = URL.createObjectURL(blob);
          cacheRef.current.set(i, url);
          if (i === indexRef.current) {
            setFailed(false);
            setSrc(url);
          }
        })
        .catch(() => {
          if (!cancel && i === indexRef.current) setFailed(true);
        });
    }
    return () => {
      cancel = true;
    };
  }, [index, items, token]);

  const setScale = (next: number) => {
    const g = gesture.current;
    g.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    if (g.scale === MIN_SCALE) {
      g.x = 0;
      g.y = 0;
      g.dragX = 0;
      paint();
      return;
    }
    clampPan();
    paint();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      g.mode = 'pinch';
      g.pinchStartDist = distance(pts[0], pts[1]);
      g.pinchStartScale = g.scale;
      g.dragX = 0;
      return;
    }
    g.mode = 'undecided';
    g.moved = false;
    g.downX = event.clientX;
    g.downY = event.clientY;
    g.dragX = 0;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointers.current.get(event.pointerId);
    if (!point) return;
    point.x = event.clientX;
    point.y = event.clientY;
    const g = gesture.current;

    if (pointers.current.size >= 2 || g.mode === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const dist = distance(pts[0], pts[1]);
      if (g.pinchStartDist > 0) {
        g.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.pinchStartScale * (dist / g.pinchStartDist)));
        if (g.scale <= MIN_SCALE + 0.01) {
          g.scale = MIN_SCALE;
          g.x = 0;
          g.y = 0;
        }
        clampPan();
        paint();
      }
      return;
    }

    const dx = event.clientX - g.downX;
    const dy = event.clientY - g.downY;
    if (g.mode === 'undecided') {
      if (Math.hypot(dx, dy) < 8) return;
      g.moved = true;
      if (g.scale > 1.01) g.mode = 'pan';
      else if (Math.abs(dx) > Math.abs(dy)) g.mode = 'swipe';
      else g.mode = 'pan';
      g.panStartX = event.clientX;
      g.panStartY = event.clientY;
      g.panOriginX = g.x;
      g.panOriginY = g.y;
    }
    if (g.mode === 'pan') {
      g.x = g.panOriginX + (event.clientX - g.panStartX);
      g.y = g.panOriginY + (event.clientY - g.panStartY);
      clampPan();
      paint();
    } else if (g.mode === 'swipe') {
      g.dragX = dx;
      paint();
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (pointers.current.size >= 1) {
      g.mode = 'idle';
      return;
    }
    if (g.mode === 'swipe') {
      if (g.dragX <= -56) go(indexRef.current + 1);
      else if (g.dragX >= 56) go(indexRef.current - 1);
      g.dragX = 0;
      paint();
    } else if (g.mode === 'undecided' && !g.moved) {
      const now = Date.now();
      if (now - g.lastTap < 280) {
        if (g.scale > 1.05) setScale(MIN_SCALE);
        else setScale(2.5);
        g.lastTap = 0;
      } else {
        g.lastTap = now;
      }
    }
    g.mode = 'idle';
  };

  const slide = items[index];

  return createPortal(
    <div
      ref={shellRef}
      className="fixed inset-0 z-[130] box-border h-[100dvh] w-screen bg-black text-white outline-none"
      style={SAFE_SCREEN}
      role="dialog"
      aria-modal="true"
      aria-label="교육자료 전체보기"
      tabIndex={-1}
    >
      <div
        ref={viewRef}
        className="relative h-full min-h-0 w-full touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt={slide?.title ?? '교육자료'}
            draggable={false}
            onLoad={fitContain}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              width: box ? `${box.w}px` : undefined,
              height: box ? `${box.h}px` : undefined,
              transformOrigin: 'center center',
              opacity: box ? 1 : 0,
            }}
          />
        ) : (
          <p className="flex h-full items-center justify-center px-6 text-center text-fluid-sm text-slate-300">
            {failed ? '이 장을 불러오지 못했습니다.' : '불러오는 중…'}
          </p>
        )}
        <button
          type="button"
          className="absolute left-2 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => go(index - 1)}
          disabled={index <= 0}
          aria-label="이전 장"
        >
          <LineMdIcon name="chevron-left" className="size-6" />
        </button>
        <button
          type="button"
          className="absolute right-2 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => go(index + 1)}
          disabled={index >= items.length - 1}
          aria-label="다음 장"
        >
          <LineMdIcon name="chevron-right" className="size-6" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
