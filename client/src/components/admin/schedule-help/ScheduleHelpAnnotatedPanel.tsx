import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type ScheduleHelpCalloutDef = {
  id: number;
  label: string;
  /** 콘텐츠 영역 기준 가로 % (0–100) */
  anchorX: number;
  /** 콘텐츠 영역 기준 세로 % (0–100) */
  anchorY: number;
};

type LineSeg = { id: number; x1: number; y1: number; x2: number; y2: number };

type Props = {
  callouts: readonly ScheduleHelpCalloutDef[];
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/** 스크린샷·UI 미리보기 — 번호 마커 + 연결선 + 오른쪽 설명란(겹침 없음) */
export function ScheduleHelpAnnotatedPanel({ callouts, children, className = '', contentClassName = '' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lines, setLines] = useState<LineSeg[]>([]);

  const sorted = useMemo(() => [...callouts].sort((a, b) => a.id - b.id), [callouts]);

  const recomputeLines = useCallback(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content || sorted.length === 0) {
      setLines([]);
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    setLines(
      sorted.map((c, index) => {
        const labelEl = labelRefs.current[index];
        const ax = contentRect.left - rootRect.left + (c.anchorX / 100) * contentRect.width;
        const ay = contentRect.top - rootRect.top + (c.anchorY / 100) * contentRect.height;
        const labelRect = labelEl?.getBoundingClientRect();
        const lx = labelRect ? labelRect.left - rootRect.left : rootRect.width * 0.72;
        const ly = labelRect ? labelRect.top - rootRect.top + labelRect.height / 2 : ((index + 0.5) / sorted.length) * rootRect.height;
        return { id: c.id, x1: ax, y1: ay, x2: lx, y2: ly };
      }),
    );
  }, [sorted]);

  useLayoutEffect(() => {
    recomputeLines();
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => recomputeLines());
    ro.observe(root);
    window.addEventListener('resize', recomputeLines);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recomputeLines);
    };
  }, [recomputeLines]);

  return (
    <div
      ref={rootRef}
      className={`relative flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div ref={contentRef} className={`relative min-w-0 flex-1 ${contentClassName}`}>
        {children}
        {sorted.map((c) => (
          <span
            key={`anchor-${c.id}`}
            className="absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-[11px] font-black leading-none text-white ring-2 ring-white shadow-md"
            style={{ left: `${c.anchorX}%`, top: `${c.anchorY}%` }}
            aria-hidden
          >
            {c.id}
          </span>
        ))}
      </div>

      <div className="relative z-10 flex w-[8.25rem] shrink-0 flex-col justify-evenly gap-1.5 border-l border-amber-200 bg-amber-50/95 px-1.5 py-2 sm:w-[9.5rem] sm:gap-2 sm:px-2 sm:py-2.5">
        {sorted.map((c, index) => (
          <div
            key={`label-${c.id}`}
            ref={(el) => {
              labelRefs.current[index] = el;
            }}
            className="flex items-start gap-1 rounded-md border border-amber-400 bg-white px-1.5 py-1 shadow-sm sm:gap-1.5 sm:px-2 sm:py-1.5"
          >
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black leading-none text-white sm:h-[18px] sm:w-[18px] sm:text-[11px]">
              {c.id}
            </span>
            <span className="min-w-0 text-[8px] font-semibold leading-snug text-slate-900 sm:text-[9px]">{c.label}</span>
          </div>
        ))}
      </div>

      <svg
        className="pointer-events-none absolute inset-0 z-[15] h-full w-full overflow-visible"
        aria-hidden
      >
        {lines.map((l) => (
          <line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#b45309"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
