import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MOBILE_STAFF_DOCK_BTN_PX,
  MOBILE_STAFF_DOCK_GAP_PX,
} from '../components/layout/mobileStaffDockStyles';

export type StaffMobileFabAnchor = 'favorites' | 'bell';

const HOLD_MS = 420;
/** 롱프레스 후 세로 드래그 — 이 정도 움직이면 홀드 대기 없이 드래그 시작 */
const EARLY_DRAG_MS = 280;
const EARLY_DRAG_DY_PX = 6;
/** 가로 스크롤 의도 — 홀드 취소 */
const HORIZONTAL_CANCEL_DX_PX = 14;

type Options = {
  storageKey: string;
  /** 스택 버튼 개수(즐겨찾기·종 등) */
  stackCount: number;
  /** 짧은 탭 — favorites만(종은 ChangeLogBell onClick) */
  onFavoritesTap?: () => void;
};

/** AdminLayout·TeamLayout 공통 — 모바일 우측 FAB 세로 스택(길게 눌러 이동) */
export function useStaffMobileFabStack({ storageKey, stackCount, onFavoritesTap }: Options) {
  const [fabTop, setFabTop] = useState<number | null>(null);
  const fabTopRef = useRef<number | null>(null);
  const [fabDragging, setFabDragging] = useState(false);
  const [fabPressActive, setFabPressActive] = useState(false);
  const fabDraggingRef = useRef(false);
  const fabPointerIdRef = useRef<number | null>(null);
  const fabHoldTimerRef = useRef<number | null>(null);
  const fabDragOffsetRef = useRef({ y: 0 });
  const fabPressMovedRef = useRef(false);
  const fabPointerAnchorRef = useRef<StaffMobileFabAnchor | null>(null);
  const fabCaptureTargetRef = useRef<HTMLElement | null>(null);
  const fabStackRef = useRef<HTMLDivElement | null>(null);
  const [fabBellMount, setFabBellMount] = useState<HTMLDivElement | null>(null);
  const stackCountRef = useRef(stackCount);
  const endPressListenersRef = useRef<(() => void) | null>(null);
  const endDragListenersRef = useRef<(() => void) | null>(null);
  const onFavoritesTapRef = useRef(onFavoritesTap);

  useEffect(() => {
    onFavoritesTapRef.current = onFavoritesTap;
  }, [onFavoritesTap]);

  useEffect(() => {
    stackCountRef.current = stackCount;
  }, [stackCount]);

  const fabSafeRight = 'max(12px, env(safe-area-inset-right, 0px))';

  const clampFabTop = useCallback((stackTop: number) => {
    if (typeof window === 'undefined') return stackTop;
    const count = stackCountRef.current;
    const stackHeight = count * MOBILE_STAFF_DOCK_BTN_PX + Math.max(0, count - 1) * MOBILE_STAFF_DOCK_GAP_PX;
    const margin = 12;
    const minY = 72;
    const maxY = Math.max(minY, window.innerHeight - margin - stackHeight);
    return Math.min(maxY, Math.max(minY, stackTop));
  }, []);

  const applyFabTopDom = useCallback((next: number) => {
    fabTopRef.current = next;
    const el = fabStackRef.current;
    if (el) el.style.top = `${next}px`;
  }, []);

  const persistFabTop = useCallback(
    (y: number) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ v: 1, y }));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  useEffect(() => {
    fabTopRef.current = fabTop;
  }, [fabTop]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fallbackY = clampFabTop(Math.round(window.innerHeight * 0.38));
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setFabTop(fallbackY);
        fabTopRef.current = fallbackY;
        return;
      }
      const parsed = JSON.parse(raw) as { y?: number };
      const y = typeof parsed?.y === 'number' ? parsed.y : undefined;
      const clamped = y != null ? clampFabTop(y) : fallbackY;
      setFabTop(clamped);
      fabTopRef.current = clamped;
    } catch {
      setFabTop(fallbackY);
      fabTopRef.current = fallbackY;
    }
  }, [clampFabTop, storageKey]);

  useEffect(() => {
    const onResize = () => {
      setFabTop((prev) => {
        if (prev == null) return prev;
        const next = clampFabTop(prev);
        fabTopRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampFabTop]);

  const clearPressListeners = useCallback(() => {
    endPressListenersRef.current?.();
    endPressListenersRef.current = null;
  }, []);

  const clearDragListeners = useCallback(() => {
    endDragListenersRef.current?.();
    endDragListenersRef.current = null;
  }, []);

  const finishPointer = useCallback(
    (evt: PointerEvent, wasDragging: boolean) => {
      try {
        fabCaptureTargetRef.current?.releasePointerCapture(evt.pointerId);
      } catch {
        /* ignore */
      }
      fabCaptureTargetRef.current = null;
      fabPointerIdRef.current = null;
      const tapAnchor = fabPointerAnchorRef.current;
      fabPointerAnchorRef.current = null;
      fabDraggingRef.current = false;
      setFabDragging(false);
      setFabPressActive(false);

      if (wasDragging) {
        const y = fabTopRef.current;
        if (y != null) {
          setFabTop(y);
          persistFabTop(y);
        }
        return;
      }

      if (!fabPressMovedRef.current && tapAnchor === 'favorites') {
        onFavoritesTapRef.current?.();
      }
      fabPressMovedRef.current = false;
    },
    [persistFabTop],
  );

  const attachDragListeners = useCallback(
    (pointerId: number) => {
      clearDragListeners();
      const onMove = (evt: PointerEvent) => {
        if (fabPointerIdRef.current == null || evt.pointerId !== pointerId) return;
        evt.preventDefault();
        applyFabTopDom(clampFabTop(evt.clientY - fabDragOffsetRef.current.y));
      };
      const onUp = (evt: PointerEvent) => {
        if (fabPointerIdRef.current == null || evt.pointerId !== pointerId) return;
        clearDragListeners();
        finishPointer(evt, true);
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      endDragListenersRef.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
    },
    [applyFabTopDom, clampFabTop, clearDragListeners, finishPointer],
  );

  const beginFabPointer = useCallback(
    (anchor: StaffMobileFabAnchor, evt: ReactPointerEvent<HTMLButtonElement>) => {
      if (evt.button !== 0) return;
      clearPressListeners();
      clearDragListeners();
      if (fabHoldTimerRef.current != null) window.clearTimeout(fabHoldTimerRef.current);

      const pointerId = evt.pointerId;
      const downAt = Date.now();
      fabPointerAnchorRef.current = anchor;
      fabPressMovedRef.current = false;
      fabPointerIdRef.current = pointerId;
      fabCaptureTargetRef.current = evt.currentTarget;
      setFabPressActive(true);
      const container = fabStackRef.current;
      const rect = container?.getBoundingClientRect() ?? evt.currentTarget.getBoundingClientRect();
      fabDragOffsetRef.current = { y: evt.clientY - rect.top };

      const down = { x: evt.clientX, y: evt.clientY };

      const enterDragMode = () => {
        if (fabDraggingRef.current || fabPointerIdRef.current !== pointerId) return;
        clearPressListeners();
        if (fabHoldTimerRef.current != null) {
          window.clearTimeout(fabHoldTimerRef.current);
          fabHoldTimerRef.current = null;
        }
        fabDraggingRef.current = true;
        setFabDragging(true);
        try {
          fabCaptureTargetRef.current?.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
        attachDragListeners(pointerId);
      };

      const onEarlyMove = (moveEvt: PointerEvent) => {
        if (fabPointerIdRef.current == null || moveEvt.pointerId !== pointerId) return;
        const dx = Math.abs(moveEvt.clientX - down.x);
        const dy = Math.abs(moveEvt.clientY - down.y);
        if (dx + dy > 4) fabPressMovedRef.current = true;

        if (fabDraggingRef.current) return;

        if (dx > HORIZONTAL_CANCEL_DX_PX && dx > dy * 1.2) {
          if (fabHoldTimerRef.current != null) {
            window.clearTimeout(fabHoldTimerRef.current);
            fabHoldTimerRef.current = null;
          }
          return;
        }

        const elapsed = Date.now() - downAt;
        if (dy >= EARLY_DRAG_DY_PX && dy >= dx && elapsed >= EARLY_DRAG_MS) {
          enterDragMode();
        }
      };

      const onEarlyUp = (upEvt: PointerEvent) => {
        if (fabPointerIdRef.current == null || upEvt.pointerId !== pointerId) return;
        if (fabHoldTimerRef.current != null) {
          window.clearTimeout(fabHoldTimerRef.current);
          fabHoldTimerRef.current = null;
        }
        clearPressListeners();
        if (!fabDraggingRef.current) {
          finishPointer(upEvt, false);
        }
      };

      window.addEventListener('pointermove', onEarlyMove, { passive: true });
      window.addEventListener('pointerup', onEarlyUp);
      window.addEventListener('pointercancel', onEarlyUp);
      endPressListenersRef.current = () => {
        window.removeEventListener('pointermove', onEarlyMove);
        window.removeEventListener('pointerup', onEarlyUp);
        window.removeEventListener('pointercancel', onEarlyUp);
      };

      fabHoldTimerRef.current = window.setTimeout(() => {
        fabHoldTimerRef.current = null;
        enterDragMode();
      }, HOLD_MS);
    },
    [attachDragListeners, clearDragListeners, clearPressListeners, finishPointer],
  );

  useLayoutEffect(
    () => () => {
      if (fabHoldTimerRef.current != null) window.clearTimeout(fabHoldTimerRef.current);
      clearPressListeners();
      clearDragListeners();
    },
    [clearDragListeners, clearPressListeners],
  );

  return {
    fabTop,
    fabDragging,
    fabPressActive,
    fabStackRef,
    fabBellMount,
    setFabBellMount,
    fabSafeRight,
    showMobileFabStack: fabTop != null,
    beginFabPointer,
  };
}
