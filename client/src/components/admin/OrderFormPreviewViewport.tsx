import { useRef, type ReactNode } from 'react';
import { useFillViewportBottom } from '../../hooks/useFillViewportBottom';

/** 손님 미리보기 박스를 창 맨 아래까지 채워 「다음」이 한 화면에 보이게 한다. */
export function OrderFormPreviewViewport({
  children,
  className,
  bottomGapPx = 10,
  minPx = 320,
  layoutKey,
}: {
  children: ReactNode;
  className?: string;
  bottomGapPx?: number;
  minPx?: number;
  layoutKey?: string | number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useFillViewportBottom(ref, { bottomGapPx, minPx, layoutKey });

  return (
    <div
      ref={ref}
      className={className}
      style={{
        minHeight: height ?? minPx,
        height: height ?? undefined,
        maxHeight: height ?? undefined,
      }}
    >
      {children}
    </div>
  );
}
