import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MOBILE_STAFF_DOCK_BTN_PX,
  MOBILE_STAFF_DOCK_GAP_PX,
} from '../components/layout/mobileStaffDockStyles';
import {
  useStaffMobileFabBeginPointer,
  useStaffMobileFabPressRefs,
} from './staffMobileFabPointer';

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
  const fabStackRef = useRef<HTMLDivElement | null>(null);
  const [fabBellMount, setFabBellMount] = useState<HTMLDivElement | null>(null);
  const stackCountRef = useRef(stackCount);
  const onFavoritesTapRef = useRef(onFavoritesTap);
  const pressRefs = useStaffMobileFabPressRefs();

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

  const beginFabPointer = useStaffMobileFabBeginPointer(pressRefs, {
    stackRef: fabStackRef,
    topRef: fabTopRef,
    clampTop: clampFabTop,
    applyTopDom: applyFabTopDom,
    setTopState: setFabTop,
    persistTop: persistFabTop,
    setDraggingState: setFabDragging,
    onTap: (anchor) => {
      if (anchor === 'favorites') {
        onFavoritesTapRef.current?.();
      }
    },
  });

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
