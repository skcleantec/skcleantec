import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MOBILE_STAFF_DOCK_BTN_PX,
  MOBILE_STAFF_DOCK_GAP_PX,
} from '../components/layout/mobileStaffDockStyles';

export type StaffMobileFabAnchor = 'favorites' | 'bell';

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
  const fabPointerIdRef = useRef<number | null>(null);
  const fabHoldTimerRef = useRef<number | null>(null);
  const fabDragOffsetRef = useRef({ y: 0 });
  const fabPressMovedRef = useRef(false);
  const fabPointerAnchorRef = useRef<StaffMobileFabAnchor | null>(null);
  const fabStackRef = useRef<HTMLDivElement | null>(null);
  const [fabBellMount, setFabBellMount] = useState<HTMLDivElement | null>(null);
  const stackCountRef = useRef(stackCount);

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

  const beginFabPointer = useCallback(
    (anchor: StaffMobileFabAnchor, evt: ReactPointerEvent<HTMLButtonElement>) => {
      fabPointerAnchorRef.current = anchor;
      fabPressMovedRef.current = false;
      fabPointerIdRef.current = evt.pointerId;
      const container = fabStackRef.current;
      const rect = container?.getBoundingClientRect() ?? evt.currentTarget.getBoundingClientRect();
      fabDragOffsetRef.current = { y: evt.clientY - rect.top };
      if (fabHoldTimerRef.current != null) window.clearTimeout(fabHoldTimerRef.current);
      fabHoldTimerRef.current = window.setTimeout(() => setFabDragging(true), 420);
    },
    [],
  );

  useEffect(() => {
    const onMove = (evt: PointerEvent) => {
      if (fabPointerIdRef.current == null || evt.pointerId !== fabPointerIdRef.current) return;
      if (fabDragging) {
        evt.preventDefault();
        const next = clampFabTop(evt.clientY - fabDragOffsetRef.current.y);
        fabTopRef.current = next;
        setFabTop(next);
        return;
      }
      if (Math.abs(evt.movementX) + Math.abs(evt.movementY) > 2) {
        fabPressMovedRef.current = true;
      }
    };
    const onUp = (evt: PointerEvent) => {
      if (fabPointerIdRef.current == null || evt.pointerId !== fabPointerIdRef.current) return;
      if (fabHoldTimerRef.current != null) {
        window.clearTimeout(fabHoldTimerRef.current);
        fabHoldTimerRef.current = null;
      }
      const wasDragging = fabDragging;
      const tapAnchor = fabPointerAnchorRef.current;
      fabPointerIdRef.current = null;
      fabPointerAnchorRef.current = null;
      setFabDragging(false);
      if (wasDragging) {
        const y = fabTopRef.current;
        if (y != null) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify({ v: 1, y }));
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (!fabPressMovedRef.current && tapAnchor === 'favorites') {
        onFavoritesTap?.();
      }
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clampFabTop, fabDragging, onFavoritesTap, storageKey]);

  return {
    fabTop,
    fabDragging,
    fabStackRef,
    fabBellMount,
    setFabBellMount,
    fabSafeRight,
    showMobileFabStack: fabTop != null,
    beginFabPointer,
  };
}
