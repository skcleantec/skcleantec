import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type Layout = {
  scale: number;
  width: number;
  height: number;
};

type Props = {
  children: ReactNode;
  className?: string;
  sheetClassName?: string;
  sheetStyle?: CSSProperties;
  'aria-label'?: string;
};

/** A4 고정 레이아웃 — 좁은 뷰포트에서 전체 축소(가로 스크롤 없음) */
export function A4ScaledSheet({
  children,
  className = '',
  sheetClassName = '',
  sheetStyle,
  'aria-label': ariaLabel,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<Layout>({ scale: 1, width: 0, height: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    const sheet = sheetRef.current;
    if (!viewport || !sheet) return;

    const measure = () => {
      const available = viewport.clientWidth;
      const naturalWidth = sheet.offsetWidth;
      const naturalHeight = sheet.offsetHeight;
      if (available <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return;

      const scale = Math.min(1, available / naturalWidth);
      setLayout({
        scale,
        width: naturalWidth * scale,
        height: naturalHeight * scale,
      });
    };

    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(sheet);
    measure();

    return () => ro.disconnect();
  }, []);

  const scaled = layout.scale < 0.999;

  return (
    <div ref={viewportRef} className={`w-full min-w-0 touch-manipulation ${className}`}>
      <div
        className="relative mx-auto"
        style={
          layout.width > 0
            ? { width: layout.width, height: layout.height }
            : undefined
        }
      >
        <article
          ref={sheetRef}
          className={sheetClassName}
          style={{
            ...sheetStyle,
            transform: scaled ? `scale(${layout.scale})` : undefined,
            transformOrigin: 'top left',
          }}
          aria-label={ariaLabel}
        >
          {children}
        </article>
      </div>
    </div>
  );
}
