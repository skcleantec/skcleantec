import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchTeamLeaderTrainingImageBlob } from '../../api/teamLeaderTraining';
import { LineMdIcon } from '../ui/LineMdIcon';

type Slide = { index: number; title: string };

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.35;

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

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

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
  const viewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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

  const showTop = useCallback(() => {
    const view = viewRef.current;
    const img = imgRef.current;
    const g = gesture.current;
    g.scale = 1;
    g.x = 0;
    g.dragX = 0;
    if (view && img) {
      g.y = Math.max(0, (img.offsetHeight - view.clientHeight) / 2);
    } else {
      g.y = 0;
    }
    paint();
    if (img) img.style.opacity = '1';
  }, [paint]);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length || next === indexRef.current) return;
      gesture.current.mode = 'idle';
      gesture.current.dragX = 0;
      setSrc(cacheRef.current.get(next) ?? null);
      setFailed(false);
      setIndex(next);
    },
    [items.length],
  );

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (gesture.current.scale > 1.01) return;
      if (event.key === 'ArrowRight') go(indexRef.current + 1);
      if (event.key === 'ArrowLeft') go(indexRef.current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
    };
  }, [go, onClose]);

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
      showTop();
      return;
    }
    clampPan();
    paint();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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
        if (g.scale === MIN_SCALE) g.x = 0;
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

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
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
  const controlBtn =
    'inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-40 disabled:pointer-events-none';

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex flex-col bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="교육가이드"
    >
      <div className="flex shrink-0 items-center gap-2 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button ref={closeRef} type="button" className={controlBtn} onClick={onClose} aria-label="닫기">
          <LineMdIcon name="close" className="size-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-fluid-xs">
          {index + 1} / {items.length}
          {slide ? ` · ${slide.title}` : ''}
        </p>
        <button type="button" className={controlBtn} onClick={() => setScale(gesture.current.scale / ZOOM_STEP)} aria-label="축소">
          <LineMdIcon name="minus" className="size-5" />
        </button>
        <button type="button" className={controlBtn} onClick={() => setScale(gesture.current.scale * ZOOM_STEP)} aria-label="확대">
          <LineMdIcon name="plus" className="size-5" />
        </button>
      </div>

      <div
        ref={viewRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt={slide?.title ?? '교육가이드'}
            draggable={false}
            onLoad={showTop}
            className="absolute left-1/2 top-1/2 h-auto w-full max-w-none select-none"
            style={{ transformOrigin: 'center center', opacity: 0 }}
          />
        ) : (
          <p className="flex h-full items-center justify-center px-6 text-center text-fluid-sm text-slate-300">
            {failed ? '이 장을 불러오지 못했습니다.' : '불러오는 중…'}
          </p>
        )}
        <button
          type="button"
          className={`${controlBtn} absolute left-2 top-1/2 -translate-y-1/2`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => go(index - 1)}
          disabled={index <= 0}
          aria-label="이전 장"
        >
          <LineMdIcon name="chevron-left" className="size-6" />
        </button>
        <button
          type="button"
          className={`${controlBtn} absolute right-2 top-1/2 -translate-y-1/2`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => go(index + 1)}
          disabled={index >= items.length - 1}
          aria-label="다음 장"
        >
          <LineMdIcon name="chevron-right" className="size-6" />
        </button>
      </div>

      <p className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center text-fluid-2xs text-slate-300">
        좌우로 넘기고, 두 손가락이나 ＋ − 로 글자를 키우거나 줄이세요.
      </p>
    </div>,
    document.body,
  );
}
