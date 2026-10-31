import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Box = { top: number; left: number; width: number };

/** 표 overflow에 잘리지 않게 화면 위에 띄운다. 아래가 좁으면 위로 연다. */
export function AnchoredMenu({
  label,
  children,
  size = 'md',
}: {
  label: string;
  children: (close: () => void) => ReactNode;
  /** lg 44px(모바일 카드) · md 36px(기본) · sm 28px(표 작업 칸, 버튼 규칙) */
  size?: 'lg' | 'md' | 'sm';
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [up, setUp] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 220;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom;
    const openUp = below < 240 && rect.top > below;
    setUp(openUp);
    setBox({ top: openUp ? rect.top - 8 : rect.bottom + 4, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`inline-flex ${size === 'sm' ? 'size-7 rounded-[7px] text-xs' : size === 'lg' ? 'size-11 rounded-[10px] text-fluid-sm' : 'size-9 rounded-lg text-fluid-sm'} items-center justify-center border border-slate-300 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open && box ? createPortal(
        <div
          id={menuId}
          ref={popRef}
          className="fixed z-[80] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          style={{
            width: box.width,
            left: box.left,
            top: box.top,
            transform: up ? 'translateY(-100%)' : undefined,
          }}
        >
          {children(() => setOpen(false))}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
