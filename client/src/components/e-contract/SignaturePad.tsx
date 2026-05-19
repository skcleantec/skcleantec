import { useCallback, useEffect, useRef, useState } from 'react';

function fitCanvasDpi(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export type SignaturePadProps = {
  disabled?: boolean;
  busy?: boolean;
  /** move 이벤트 누적 최소치(기본 8) */
  minStrokePoints?: number;
  onSave: (blob: Blob) => void | Promise<void>;
  onClear?: () => void;
  saveButtonLabel?: string;
  hint?: string;
  canvasHeightClass?: string;
};

/** 마우스·펜·터치로 서명을 그려 PNG blob으로보내는 패드 */
export function SignaturePad({
  disabled = false,
  busy = false,
  minStrokePoints = 8,
  onSave,
  onClear,
  saveButtonLabel = '서명을 이미지로 저장',
  hint = '마우스·펜·손가락으로 박스 안에 서명을 그려 주세요.',
  canvasHeightClass = 'h-44',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const sketchEventsRef = useRef(0);
  const [padErr, setPadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setupCanvasSizing = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    fitCanvasDpi(c);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    sketchEventsRef.current = 0;
    lastPtRef.current = null;
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      setupCanvasSizing();
    });
    ro.observe(c);
    setupCanvasSizing();
    return () => ro.disconnect();
  }, [setupCanvasSizing]);

  const clearCanvas = () => {
    setupCanvasSizing();
    setPadErr(null);
    onClear?.();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || busy || saving) return;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    setPadErr(null);
    const rect = c.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    lastPtRef.current = { x, y };
    sketchEventsRef.current += 1;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled || busy || saving) return;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const prev = lastPtRef.current;
    if (prev) {
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      sketchEventsRef.current += 1;
    }
    lastPtRef.current = { x, y };
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastPtRef.current = null;
  };

  const saveAsPng = async () => {
    if (disabled || busy || saving) return;
    if (sketchEventsRef.current < minStrokePoints) {
      setPadErr('서명을 충분히 그린 뒤 다시 저장해 주세요.');
      return;
    }
    const c = canvasRef.current;
    if (!c) return;
    setSaving(true);
    setPadErr(null);
    try {
      await new Promise<void>((resolve, reject) => {
        c.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error('서명 이미지를 만들지 못했습니다.'));
              return;
            }
            try {
              await onSave(blob);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          'image/png',
          1
        );
      });
    } catch (e) {
      setPadErr(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const controlsDisabled = disabled || busy || saving;

  return (
    <div className="mt-3">
      <p className="text-fluid-2xs text-gray-600">{hint}</p>
      <div
        className={`mt-2 rounded-md border border-gray-300 bg-white ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <canvas
          ref={canvasRef}
          className={`w-full touch-none ${canvasHeightClass}`}
          aria-label="서명 패드"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => endStroke()}
          onPointerLeave={() => endStroke()}
          onPointerCancel={() => endStroke()}
        />
      </div>
      {padErr ? <p className="mt-2 text-fluid-2xs text-red-700">{padErr}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => clearCanvas()}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-fluid-xs text-gray-800 disabled:opacity-50"
        >
          지우기
        </button>
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => void saveAsPng()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-fluid-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? '저장 중…' : saveButtonLabel}
        </button>
      </div>
    </div>
  );
}
