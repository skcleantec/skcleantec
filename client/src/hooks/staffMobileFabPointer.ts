import {
  useCallback,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

/** NavFavoritesRightRail·UI 가이드와 동일 — 길게 누르기 후 세로 이동 */
export const STAFF_MOBILE_FAB_HOLD_MS = 420;
/** 롱프레스 대기 중 이 이상 움직이면 홀드 취소(짧은 탭과 구분) */
const HOLD_CANCEL_MOVE_PX = 10;

export type StaffMobileFabPressRefs = {
  pointerIdRef: MutableRefObject<number | null>;
  holdTimerRef: MutableRefObject<number | null>;
  dragOffsetRef: MutableRefObject<{ y: number }>;
  pressMovedRef: MutableRefObject<boolean>;
  pointerAnchorRef: MutableRefObject<string | null>;
  draggingRef: MutableRefObject<boolean>;
  captureTargetRef: MutableRefObject<HTMLElement | null>;
  endPressListenersRef: MutableRefObject<(() => void) | null>;
  endDragListenersRef: MutableRefObject<(() => void) | null>;
};

export type StaffMobileFabPressConfig = {
  stackRef: RefObject<HTMLDivElement | null>;
  topRef: MutableRefObject<number | null>;
  clampTop: (stackTop: number) => number;
  applyTopDom: (y: number) => void;
  setTopState: (y: number) => void;
  persistTop: (y: number) => void;
  setDraggingState: (dragging: boolean) => void;
  onTap?: (anchor: string) => void;
};

export function useStaffMobileFabPressRefs(): StaffMobileFabPressRefs {
  return {
    pointerIdRef: useRef<number | null>(null),
    holdTimerRef: useRef<number | null>(null),
    dragOffsetRef: useRef({ y: 0 }),
    pressMovedRef: useRef(false),
    pointerAnchorRef: useRef<string | null>(null),
    draggingRef: useRef(false),
    captureTargetRef: useRef<HTMLElement | null>(null),
    endPressListenersRef: useRef<(() => void) | null>(null),
    endDragListenersRef: useRef<(() => void) | null>(null),
  };
}

/** 모바일 FAB — 버튼 onPointerDown (스택 위임·조기 capture 금지) */
export function useStaffMobileFabBeginPointer(
  refs: StaffMobileFabPressRefs,
  config: StaffMobileFabPressConfig,
) {
  const configRef = useRef(config);
  configRef.current = config;

  const clearPressListeners = useCallback(() => {
    refs.endPressListenersRef.current?.();
    refs.endPressListenersRef.current = null;
  }, [refs]);

  const clearDragListeners = useCallback(() => {
    refs.endDragListenersRef.current?.();
    refs.endDragListenersRef.current = null;
  }, [refs]);

  const finishPointer = useCallback(
    (evt: PointerEvent, wasDragging: boolean) => {
      const cfg = configRef.current;
      try {
        refs.captureTargetRef.current?.releasePointerCapture(evt.pointerId);
      } catch {
        /* ignore */
      }
      refs.captureTargetRef.current = null;
      refs.pointerIdRef.current = null;
      const tapAnchor = refs.pointerAnchorRef.current;
      refs.pointerAnchorRef.current = null;
      refs.draggingRef.current = false;
      cfg.setDraggingState(false);

      if (wasDragging) {
        const y = cfg.topRef.current;
        if (y != null) {
          cfg.setTopState(y);
          cfg.persistTop(y);
        }
        refs.pressMovedRef.current = false;
        return;
      }

      if (!refs.pressMovedRef.current && tapAnchor) {
        cfg.onTap?.(tapAnchor);
      }
      refs.pressMovedRef.current = false;
    },
    [refs],
  );

  const attachDragListeners = useCallback(
    (pointerId: number) => {
      clearDragListeners();
      const onMove = (evt: PointerEvent) => {
        if (refs.pointerIdRef.current == null || evt.pointerId !== pointerId) return;
        evt.preventDefault();
        const cfg = configRef.current;
        cfg.applyTopDom(cfg.clampTop(evt.clientY - refs.dragOffsetRef.current.y));
      };
      const onUp = (evt: PointerEvent) => {
        if (refs.pointerIdRef.current == null || evt.pointerId !== pointerId) return;
        clearDragListeners();
        finishPointer(evt, true);
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      refs.endDragListenersRef.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
    },
    [clearDragListeners, finishPointer, refs],
  );

  const beginFabPointer = useCallback(
    (anchor: string, evt: ReactPointerEvent<HTMLButtonElement>) => {
      if (evt.button !== 0) return;
      clearPressListeners();
      clearDragListeners();
      if (refs.holdTimerRef.current != null) window.clearTimeout(refs.holdTimerRef.current);

      const pointerId = evt.pointerId;
      refs.pointerAnchorRef.current = anchor;
      refs.pressMovedRef.current = false;
      refs.pointerIdRef.current = pointerId;
      refs.captureTargetRef.current = evt.currentTarget;

      const cfg = configRef.current;
      const rect =
        cfg.stackRef.current?.getBoundingClientRect() ?? evt.currentTarget.getBoundingClientRect();
      refs.dragOffsetRef.current = { y: evt.clientY - rect.top };

      const down = { x: evt.clientX, y: evt.clientY };

      const onEarlyMove = (moveEvt: PointerEvent) => {
        if (refs.pointerIdRef.current == null || moveEvt.pointerId !== pointerId) return;
        const dx = Math.abs(moveEvt.clientX - down.x);
        const dy = Math.abs(moveEvt.clientY - down.y);
        if (dx + dy > HOLD_CANCEL_MOVE_PX) {
          refs.pressMovedRef.current = true;
          if (refs.holdTimerRef.current != null) {
            window.clearTimeout(refs.holdTimerRef.current);
            refs.holdTimerRef.current = null;
          }
        }
      };

      const onEarlyUp = (upEvt: PointerEvent) => {
        if (refs.pointerIdRef.current == null || upEvt.pointerId !== pointerId) return;
        if (refs.holdTimerRef.current != null) {
          window.clearTimeout(refs.holdTimerRef.current);
          refs.holdTimerRef.current = null;
        }
        clearPressListeners();
        if (!refs.draggingRef.current) {
          finishPointer(upEvt, false);
        }
      };

      window.addEventListener('pointermove', onEarlyMove, { passive: true });
      window.addEventListener('pointerup', onEarlyUp);
      window.addEventListener('pointercancel', onEarlyUp);
      refs.endPressListenersRef.current = () => {
        window.removeEventListener('pointermove', onEarlyMove);
        window.removeEventListener('pointerup', onEarlyUp);
        window.removeEventListener('pointercancel', onEarlyUp);
      };

      refs.holdTimerRef.current = window.setTimeout(() => {
        refs.holdTimerRef.current = null;
        if (refs.pointerIdRef.current !== pointerId) return;
        clearPressListeners();
        refs.draggingRef.current = true;
        cfg.setDraggingState(true);
        try {
          refs.captureTargetRef.current?.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
        attachDragListeners(pointerId);
      }, STAFF_MOBILE_FAB_HOLD_MS);
    },
    [attachDragListeners, clearDragListeners, clearPressListeners, finishPointer, refs],
  );

  useLayoutEffect(
    () => () => {
      if (refs.holdTimerRef.current != null) window.clearTimeout(refs.holdTimerRef.current);
      clearPressListeners();
      clearDragListeners();
    },
    [clearDragListeners, clearPressListeners, refs],
  );

  return beginFabPointer;
}
