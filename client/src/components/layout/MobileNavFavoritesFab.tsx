import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import {
  MOBILE_STAFF_DOCK_BTN_CLASS,
  MOBILE_STAFF_DOCK_ICON_CLASS,
} from './mobileStaffDockStyles';

export type MobileNavFavoriteItem = {
  key: string;
  to: string;
  label: string;
  icon?: ReactNode;
};

function StarFabIcon({ filled, className }: { filled?: boolean; className?: string }) {
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

function MobileNavFavoritesSheet({
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
    <div className="fixed inset-0 z-[125] lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="즐겨찾기 닫기"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="mobile-nav-favorites-title"
        className={`theme-dark-header absolute inset-x-0 top-0 max-h-[min(52dvh,22rem)] flex flex-col border-b border-white/10 bg-slate-900 shadow-2xl transition-transform duration-200 ease-out staff-top-safe ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <StarFabIcon filled className="h-5 w-5 shrink-0 text-amber-300" />
            <h2 id="mobile-nav-favorites-title" className="text-fluid-sm font-semibold text-white">
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white touch-manipulation"
            aria-label="닫기"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-4 text-center text-fluid-2xs leading-snug text-slate-300">
              등록된 즐겨찾기가 없습니다.
              <br />
              각 화면 <strong className="font-semibold text-amber-200">제목 옆 ★</strong>를 눌러 추가하세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <li key={item.key}>
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-fluid-sm font-semibold text-amber-50 touch-manipulation active:bg-amber-500/20"
                  >
                    <span className="text-amber-300" aria-hidden>
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
          아래 ★ 버튼 또는 화면 제목 옆 ★로 관리
        </p>
      </div>
    </div>,
    root,
  );
}

type FabButtonProps = {
  count: number;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onOpen: () => void;
  /** admin FAB 스택 안 — 탭은 부모 pointerup에서 처리 */
  deferTapToParent?: boolean;
};

function MobileNavFavoritesFabButton({ count, onPointerDown, onOpen, deferTapToParent }: FabButtonProps) {
  return (
    <button
      type="button"
      aria-label={count > 0 ? `즐겨찾기 ${count}개 — 메뉴 열기` : '즐겨찾기 — 메뉴 열기'}
      title="즐겨찾기 (길게 눌러 세로 위치 이동)"
      onClick={deferTapToParent ? undefined : onOpen}
      onPointerDown={onPointerDown}
      className={`${MOBILE_STAFF_DOCK_BTN_CLASS} border border-violet-300/50 bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-[0_2px_8px_rgba(109,40,217,0.35),0_1px_2px_rgba(15,23,42,0.12)] ring-1 ring-inset ring-white/20 active:shadow-sm`}
    >
      <StarFabIcon className={MOBILE_STAFF_DOCK_ICON_CLASS} />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-amber-400 px-0.5 text-[9px] font-bold leading-none text-slate-950 tabular-nums ring-1 ring-violet-700">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  );
}

type AccessProps = {
  items: MobileNavFavoriteItem[];
  ready: boolean;
  /** admin FAB 스택: pointerup에서 open 호출 */
  registerOpen?: (open: () => void) => void;
  fabStack?: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  };
  /** team 등 단독 고정 FAB */
  standalone?: boolean;
};

/** 모바일(lg 미만) — 즐겨찾기 ★ FAB + 상단 내려오는 패널 */
export function MobileNavFavoritesAccess({
  items,
  ready,
  registerOpen,
  fabStack,
  standalone = false,
}: AccessProps) {
  const [open, setOpen] = useState(false);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);

  useEffect(() => {
    registerOpen?.(openPanel);
  }, [registerOpen, openPanel]);

  if (!ready) return null;

  return (
    <>
      {standalone ? (
        <div
          className="fixed z-[120] lg:hidden"
          style={{
            right: 'max(12px, env(safe-area-inset-right, 0px))',
            bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))',
          }}
        >
          <MobileNavFavoritesFabButton count={items.length} onOpen={openPanel} />
        </div>
      ) : fabStack ? (
        <MobileNavFavoritesFabButton
          count={items.length}
          onOpen={openPanel}
          onPointerDown={fabStack.onPointerDown}
          deferTapToParent
        />
      ) : null}
      <MobileNavFavoritesSheet open={open} onClose={closePanel} items={items} />
    </>
  );
}
