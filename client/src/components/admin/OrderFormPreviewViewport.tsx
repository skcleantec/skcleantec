import { useRef, type ReactNode } from 'react';
import { useFillViewportBottom } from '../../hooks/useFillViewportBottom';

/** 손님 미리보기 박스를 창 맨 아래까지 채워 「다음」이 한 화면에 보이게 한다. */
export function OrderFormPreviewViewport({
  children,
  className,
  bottomGapPx = 10,
}: {
  children: ReactNode;
  className?: string;
  bottomGapPx?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useFillViewportBottom(ref, { bottomGapPx, minPx: 320 });

  return (
    <div
      ref={ref}
      className={className}
      style={height != null ? { height, maxHeight: height } : undefined}
    >
      {children}
    </div>
  );
}
