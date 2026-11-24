import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MessageAttachment } from '../../api/messages';
import { downloadRemoteImage } from '../ui/ImageThumbLightbox';
import { imageThumb } from './messageAttachments';

type Props = {
  images: MessageAttachment[];
  startIndex: number;
  /** 위쪽에 보이는 설명 (보낸 사람 · 시간 등) */
  caption?: string;
  onClose: () => void;
};

/** 사진 크게 보기 — 원본을 불러온다. 좌우로 넘기고, 눌러서 확대한다. */
export function MessagePhotoViewer({ images, startIndex, caption, onClose }: Props) {
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), images.length - 1));
  const [zoomed, setZoomed] = useState(false);
  const [saving, setSaving] = useState<null | 'one' | 'all'>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const current = images[index];
  const many = images.length > 1;

  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      setIndex((i) => Math.min(Math.max(i + delta, 0), images.length - 1));
    },
    [images.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  if (!current) return null;

  const saveOne = async () => {
    if (saving) return;
    setSaving('one');
    await downloadRemoteImage(current.originalUrl, current.fileName);
    setSaving(null);
  };
  const saveAll = async () => {
    if (saving) return;
    setSaving('all');
    for (const img of images) {
      await downloadRemoteImage(img.originalUrl, img.fileName);
    }
    setSaving(null);
  };

  const btn =
    'inline-flex h-9 items-center justify-center rounded-lg bg-white/15 px-3 text-[12.5px] font-bold text-white hover:bg-white/25 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      className="fixed inset-0 z-[1200] flex flex-col bg-[#0b1020] text-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex shrink-0 items-center gap-3 px-3 py-2.5 md:px-4">
        <button type="button" onClick={onClose} aria-label="닫기" className={`${btn} w-9 px-0 text-base md:hidden`}>
          ✕
        </button>
        <div className="min-w-0 flex-1 text-center md:text-left">
          <div className="text-[13px] font-bold tabular-nums md:hidden">
            {index + 1} / {images.length}
          </div>
          {caption ? <div className="truncate text-[12px] text-slate-300 md:text-[13px]">{caption}</div> : null}
        </div>
        <div className="hidden text-[13px] font-bold tabular-nums md:block">
          {index + 1} / {images.length}
        </div>
        <div className="hidden flex-1 justify-end gap-1.5 md:flex">
          <button type="button" className={btn} onClick={saveOne} disabled={saving !== null}>
            {saving === 'one' ? '저장 중…' : '원본 저장'}
          </button>
          {many ? (
            <button type="button" className={btn} onClick={saveAll} disabled={saving !== null}>
              {saving === 'all' ? '저장 중…' : '묶음 전체 저장'}
            </button>
          ) : null}
          <button type="button" className={btn} onClick={onClose}>
            닫기 ✕
          </button>
        </div>
        <span className="w-9 md:hidden" />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {many ? (
          <button
            type="button"
            aria-label="이전 사진"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="absolute left-3 z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg hover:bg-white/25 disabled:opacity-30 md:flex"
          >
            ‹
          </button>
        ) : null}
        <div
          className={`h-full w-full ${zoomed ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}
          onTouchStart={(e) => {
            const t = e.touches[0];
            touchStart.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const s = touchStart.current;
            touchStart.current = null;
            if (!s || zoomed) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - s.x;
            const dy = t.clientY - s.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          <img
            key={current.id}
            src={current.originalUrl}
            alt={current.fileName}
            onClick={() => setZoomed((z) => !z)}
            draggable={false}
            className={
              zoomed
                ? 'block max-w-none cursor-zoom-out'
                : 'max-h-full max-w-full cursor-zoom-in object-contain'
            }
            style={zoomed ? { width: '250%', touchAction: 'pan-x pan-y pinch-zoom' } : { touchAction: 'pinch-zoom' }}
          />
        </div>
        {many ? (
          <button
            type="button"
            aria-label="다음 사진"
            onClick={() => go(1)}
            disabled={index === images.length - 1}
            className="absolute right-3 z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg hover:bg-white/25 disabled:opacity-30 md:flex"
          >
            ›
          </button>
        ) : null}
      </div>

      <p className="shrink-0 pb-1 pt-2 text-center text-[11.5px] text-slate-300 md:hidden">
        사진을 누르면 확대 · 좌우로 밀어 넘기기
      </p>

      {many ? (
        <div className="flex shrink-0 justify-start gap-1.5 overflow-x-auto px-3 py-2 md:justify-center">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setZoomed(false);
                setIndex(i);
              }}
              aria-label={`사진 ${i + 1}`}
              aria-current={i === index}
              className={`h-11 w-11 shrink-0 overflow-hidden rounded-md border-2 md:h-14 md:w-14 ${
                i === index ? 'border-violet-400' : 'border-transparent opacity-70'
              }`}
            >
              <img src={imageThumb(img)} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid shrink-0 grid-cols-2 gap-2 px-3 pb-3 pt-1 md:hidden">
        <button type="button" className={`${btn} h-10 ${many ? '' : 'col-span-2'}`} onClick={saveOne} disabled={saving !== null}>
          {saving === 'one' ? '저장 중…' : '이 사진 저장'}
        </button>
        {many ? (
          <button type="button" className={`${btn} h-10`} onClick={saveAll} disabled={saving !== null}>
            {saving === 'all' ? '저장 중…' : `${images.length}장 모두 저장`}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
