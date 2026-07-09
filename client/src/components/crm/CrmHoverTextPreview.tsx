import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** lg 이상 — 긴 텍스트 hover 시 전체 내용 팝오버 */
export function CrmHoverTextPreview({
  text,
  label,
  children,
  enabled = true,
  minLength = 40,
}: {
  text: string;
  label?: string;
  children: ReactNode;
  enabled?: boolean;
  /** 이보다 짧으면 hover 팝오버 생략 */
  minLength?: number;
}) {
  const id = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const trimmed = text.trim();
  const canPreview = enabled && trimmed.length >= minLength;

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelW = Math.min(480, window.innerWidth - 24);
    let left = rect.left;
    if (left + panelW > window.innerWidth - 12) left = window.innerWidth - panelW - 12;
    if (left < 12) left = 12;
    const top = Math.min(rect.bottom + 8, window.innerHeight - 280);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <div
      ref={anchorRef}
      className="relative min-w-0"
      onMouseEnter={() => {
        if (!canPreview || !window.matchMedia('(min-width: 1024px)').matches) return;
        updatePos();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && pos && canPreview
        ? createPortal(
            <div
              role="tooltip"
              id={id}
              className="pointer-events-none fixed z-[200] max-h-[min(70vh,420px)] w-[min(480px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
              style={{ top: pos.top, left: pos.left }}
            >
              {label ? (
                <p className="mb-2 text-fluid-xs font-semibold text-slate-800">{label}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-fluid-sm leading-relaxed text-slate-800">{trimmed}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
