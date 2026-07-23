import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import type { MobileNavFavoriteItem } from './MobileNavFavoritesFab';
import {
  staffDesktopDockButtonClass,
  staffDesktopDockDividerClass,
  staffDesktopDockShellClass,
  STAFF_DESKTOP_DOCK_BTN_PX,
  STAFF_DESKTOP_DOCK_GAP_PX,
  STAFF_DESKTOP_DOCK_STORAGE_KEY,
  type StaffDesktopDockDragHandlers,
} from './staffRightRailStyles';

function StarIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function NavFavoritesRightPanel({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: MobileNavFavoriteItem[];
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div className="fixed inset-0 z-[35] hidden lg:block" role="presentation">
      <button
        type="button"
        aria-label="즐겨찾기 닫기"
        className={`absolute inset-0 bg-black/25 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="desktop-nav-favorites-title"
        className={`theme-dark-header absolute inset-y-0 right-0 flex w-[min(16rem,85vw)] max-w-xs flex-col border-l border-white/10 bg-slate-900 shadow-2xl transition-transform duration-200 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <StarIcon filled className="h-5 w-5 shrink-0 text-amber-300" />
            <h2 id="desktop-nav-favorites-title" className="text-fluid-sm font-semibold text-white">
              즐겨찾기
            </h2>
            {items.length > 0 ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200">
                {items.length}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="닫기"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-4 text-center text-fluid-2xs leading-snug text-slate-300">
              등록된 즐겨찾기가 없습니다.
              <br />
              각 화면 <strong className="font-semibold text-amber-200">제목 옆 ★</strong>를 눌러 추가하세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.key}>
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-fluid-xs font-semibold transition-colors ${
                        isActive
                          ? 'border-amber-400/50 bg-amber-500/20 text-amber-50'
                          : 'border-amber-400/20 bg-amber-500/10 text-amber-50 hover:bg-amber-500/15'
                      }`
                    }
                  >
                    <span className="shrink-0 text-amber-300" aria-hidden>
                      ★
                    </span>
                    {item.icon ? <span className="shrink-0 opacity-90">{item.icon}</span> : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="shrink-0 border-t border-white/10 px-4 py-2 text-center text-[10px] text-slate-400">
          화면 제목 옆 ★로 추가·해제
        </p>
      </div>
    </div>,
    root,
  );
}

type Props = {
  items: MobileNavFavoriteItem[];
  ready: boolean;
  onChangelogMount?: (node: HTMLDivElement | null) => void;
  onDockDragChange?: (handlers: StaffDesktopDockDragHandlers | null) => void;
  withChangelogSlot?: boolean;
};

/** PC(lg+) — 우측 고정 GNB 톤 독 + 길게 눌러 세로 이동 */
export function NavFavoritesRightRail({
  items,
  ready,
  onChangelogMount,
  onDockDragChange,
  withChangelogSlot = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);

  const dockRef = useRef<HTMLDivElement | null>(null);
  const dockTopRef = useRef<number | null>(null);
  const [dockTop, setDockTop] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const pointerAnchorRef = useRef<'favorites' | 'bell' | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ y: 0 });
  const pressMovedRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);

  const slotCount = withChangelogSlot ? 2 : 1;
  const stackHeight =
    slotCount * STAFF_DESKTOP_DOCK_BTN_PX + Math.max(0, slotCount - 1) * STAFF_DESKTOP_DOCK_GAP_PX;

  const clampDockTop = useCallback(
    (stackTop: number) => {
      if (typeof window === 'undefined') return stackTop;
      const margin = 72;
      const minY = margin;
      const maxY = Math.max(minY, window.innerHeight - margin - stackHeight);
      return Math.min(maxY, Math.max(minY, stackTop));
    },
    [stackHeight],
  );

  useEffect(() => {
    dockTopRef.current = dockTop;
  }, [dockTop]);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    const fallbackY = clampDockTop(Math.round(window.innerHeight * 0.42 - stackHeight / 2));
    try {
      const raw = window.localStorage.getItem(STAFF_DESKTOP_DOCK_STORAGE_KEY);
      if (!raw) {
        setDockTop(fallbackY);
        dockTopRef.current = fallbackY;
        return;
      }
      const parsed = JSON.parse(raw) as { y?: number };
      const y = typeof parsed?.y === 'number' ? parsed.y : undefined;
      const clamped = y != null ? clampDockTop(y) : fallbackY;
      setDockTop(clamped);
      dockTopRef.current = clamped;
    } catch {
      setDockTop(fallbackY);
      dockTopRef.current = fallbackY;
    }
  }, [ready, clampDockTop, stackHeight]);

  useEffect(() => {
    const onResize = () => {
      setDockTop((prev) => {
        if (prev == null) return prev;
        const next = clampDockTop(prev);
        dockTopRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampDockTop]);

  const beginDockPointer = useCallback(
    (anchor: 'favorites' | 'bell', evt: ReactPointerEvent<HTMLButtonElement>) => {
      pointerAnchorRef.current = anchor;
      pressMovedRef.current = false;
      pointerIdRef.current = evt.pointerId;
      const rect = dockRef.current?.getBoundingClientRect() ?? evt.currentTarget.getBoundingClientRect();
      dragOffsetRef.current = { y: evt.clientY - rect.top };
      if (holdTimerRef.current != null) window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = window.setTimeout(() => {
        setDragging(true);
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
      }, 420);
    },
    [],
  );

  useEffect(() => {
    const onMove = (evt: PointerEvent) => {
      if (pointerIdRef.current == null || evt.pointerId !== pointerIdRef.current) return;
      if (dragging) {
        evt.preventDefault();
        const next = clampDockTop(evt.clientY - dragOffsetRef.current.y);
        dockTopRef.current = next;
        setDockTop(next);
        return;
      }
      if (Math.abs(evt.movementX) + Math.abs(evt.movementY) > 2) {
        pressMovedRef.current = true;
      }
    };

    const onUp = (evt: PointerEvent) => {
      if (pointerIdRef.current == null || evt.pointerId !== pointerIdRef.current) return;
      if (holdTimerRef.current != null) window.clearTimeout(holdTimerRef.current);
      const anchor = pointerAnchorRef.current;
      const wasDragging = dragging;
      const moved = pressMovedRef.current;
      pointerIdRef.current = null;
      pointerAnchorRef.current = null;
      pressMovedRef.current = false;
      setDragging(false);

      if (wasDragging && dockTopRef.current != null) {
        try {
          window.localStorage.setItem(
            STAFF_DESKTOP_DOCK_STORAGE_KEY,
            JSON.stringify({ y: dockTopRef.current }),
          );
        } catch {
          /* ignore */
        }
        return;
      }

      if (!moved && anchor === 'favorites') {
        openPanel();
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
  }, [clampDockTop, dragging, openPanel]);

  const bellPointerDown = useCallback(
    (evt: ReactPointerEvent<HTMLButtonElement>) => {
      beginDockPointer('bell', evt);
    },
    [beginDockPointer],
  );

  useEffect(() => {
    if (!ready) {
      onDockDragChange?.(null);
      return;
    }
    onDockDragChange?.({ dragging, onPointerDown: bellPointerDown });
  }, [ready, dragging, bellPointerDown, onDockDragChange]);

  const changelogMountRef = useCallback(
    (node: HTMLDivElement | null) => {
      onChangelogMount?.(node);
    },
    [onChangelogMount],
  );

  if (!ready || dockTop == null) return null;

  const count = items.length;
  const openLabel = count > 0 ? `즐겨찾기 ${count}개 — 메뉴 열기` : '즐겨찾기 — 메뉴 열기';

  return (
    <>
      <div
        ref={dockRef}
        className={staffDesktopDockShellClass(dragging)}
        style={{
          top: dockTop,
          right: 'max(0px, env(safe-area-inset-right, 0px))',
        }}
      >
        <button
          type="button"
          aria-label={openLabel}
          aria-expanded={open}
          title={dragging ? '세로 위치 이동 중' : '즐겨찾기 (길게 눌러 세로 이동)'}
          onPointerDown={(evt) => beginDockPointer('favorites', evt)}
          className={staffDesktopDockButtonClass(open, { dragging })}
        >
          <StarIcon filled className="h-4 w-4" />
          {count > 0 ? (
            <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-none text-slate-950 tabular-nums ring-2 ring-[#0f172a]">
              {count > 9 ? '9+' : count}
            </span>
          ) : null}
        </button>
        {withChangelogSlot ? (
          <>
            <div className={staffDesktopDockDividerClass()} aria-hidden />
            <div ref={changelogMountRef} className="flex items-center justify-center" />
          </>
        ) : null}
      </div>
      <NavFavoritesRightPanel open={open} onClose={closePanel} items={items} />
    </>
  );
}
