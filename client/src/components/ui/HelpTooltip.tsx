import { useEffect, useRef, useState } from 'react';

/** Desktop: hover shows panel. Mobile: tap ? to toggle; tap outside or Esc closes. */
export function HelpTooltip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (evt: MouseEvent | TouchEvent) => {
      const target = evt.target as Node | null;
      if (!target) return;
      if (wrapRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative group inline-flex ${className ?? ''}`}>
      <button
        type="button"
        aria-label={'\uB3C4\uC6C0\uB9D0'}
        onClick={() => setOpen((p) => !p)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
      >
        ?
      </button>
      <div
        className={`absolute left-0 top-7 z-20 max-w-sm w-80 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 shadow-lg whitespace-pre-wrap ${
          open ? 'block' : 'hidden group-hover:block'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
