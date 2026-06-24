import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InspectionAreaPhoto } from '../../api/inquiryInspection';
import { ModalCloseButton } from '../admin/ModalCloseButton';

function sanitizeFilenamePart(raw: string): string {
  const t = raw.trim().replace(/[^\w\uAC00-\uD7A3.-]+/g, '_').slice(0, 40);
  return t || 'photo';
}

async function downloadPhoto(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch_failed');
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? '.png' : blob.type.includes('webp') ? '.webp' : '.jpg';
    const name = filename.includes('.') ? filename : `${filename}${ext}`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

type OpenState = {
  beforeIndex: number;
  afterIndex: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  itemLabel: string;
  beforePhotos: InspectionAreaPhoto[];
  afterPhotos: InspectionAreaPhoto[];
  initial?: OpenState;
};

function PhotoPane({
  label,
  tone,
  photos,
  index,
  onIndexChange,
  itemLabel,
  phaseTag,
}: {
  label: string;
  tone: 'before' | 'after';
  photos: InspectionAreaPhoto[];
  index: number;
  onIndexChange: (next: number) => void;
  itemLabel: string;
  phaseTag: 'before' | 'after';
}) {
  const [downloadBusy, setDownloadBusy] = useState(false);
  const photo = photos[index];
  const multi = photos.length > 1;
  const headerCls =
    tone === 'before' ? 'border-sky-200/80 bg-sky-950/40 text-sky-100' : 'border-emerald-200/80 bg-emerald-950/40 text-emerald-100';

  const handleDownload = async () => {
    if (!photo || downloadBusy) return;
    setDownloadBusy(true);
    try {
      const base = sanitizeFilenamePart(itemLabel);
      await downloadPhoto(photo.secureUrl, `${base}_${phaseTag}_${index + 1}.jpg`);
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`shrink-0 border-b px-2 py-1.5 text-center text-xs font-semibold ${headerCls}`}>
        {label}
        {photos.length > 0 ? (
          <span className="ml-1 font-normal opacity-80">
            ({index + 1}/{photos.length})
          </span>
        ) : null}
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/30 p-2">
        {photo ? (
          <img
            src={photo.secureUrl}
            alt={`${itemLabel} ${label}`}
            className="max-h-[min(58dvh,100%)] max-w-full object-contain select-none"
            draggable={false}
          />
        ) : (
          <p className="text-sm text-white/50">사진 없음</p>
        )}
        {multi && photo ? (
          <>
            <button
              type="button"
              className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-lg text-white touch-manipulation hover:bg-black/75"
              aria-label={`${label} 이전`}
              onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-lg text-white touch-manipulation hover:bg-black/75"
              aria-label={`${label} 다음`}
              onClick={() => onIndexChange((index + 1) % photos.length)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      <div className="shrink-0 border-t border-white/10 p-2">
        <button
          type="button"
          disabled={!photo || downloadBusy}
          onClick={() => void handleDownload()}
          className="w-full min-h-[40px] rounded-lg border border-white/25 bg-black/55 text-sm font-medium text-white touch-manipulation hover:bg-black/70 disabled:opacity-40"
        >
          {downloadBusy ? '저장 중…' : `${label} 저장`}
        </button>
      </div>
    </div>
  );
}

export function InspectionPhotoCompareLightbox({
  open,
  onClose,
  itemLabel,
  beforePhotos,
  afterPhotos,
  initial,
}: Props) {
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const b = initial?.beforeIndex ?? 0;
    const a = initial?.afterIndex ?? 0;
    setBeforeIndex(beforePhotos.length ? Math.min(b, beforePhotos.length - 1) : 0);
    setAfterIndex(afterPhotos.length ? Math.min(a, afterPhotos.length - 1) : 0);
  }, [open, initial?.beforeIndex, initial?.afterIndex, beforePhotos.length, afterPhotos.length]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[720] flex flex-col bg-black/92 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-label={`${itemLabel} 검수 사진`}
      onClick={onClose}
    >
      <div className="pointer-events-none absolute left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 w-[min(94vw,28rem)] -translate-x-1/2 px-10 text-center">
        <p className="truncate text-sm font-semibold text-white drop-shadow-md">{itemLabel}</p>
        <p className="mt-0.5 text-xs text-white/70">왼쪽 청소 전 · 오른쪽 청소 후</p>
      </div>
      <ModalCloseButton onClick={onClose} className="right-2 top-2 z-20 sm:right-3 sm:top-3" />

      <div
        className="relative z-0 mx-auto mt-10 flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-2 sm:flex-row sm:gap-0 sm:divide-x sm:divide-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <PhotoPane
          label="청소 전"
          tone="before"
          photos={beforePhotos}
          index={beforeIndex}
          onIndexChange={setBeforeIndex}
          itemLabel={itemLabel}
          phaseTag="before"
        />
        <PhotoPane
          label="청소 후"
          tone="after"
          photos={afterPhotos}
          index={afterIndex}
          onIndexChange={setAfterIndex}
          itemLabel={itemLabel}
          phaseTag="after"
        />
      </div>
    </div>,
    document.body,
  );
}

export function openCompareIndices(
  phase: 'BEFORE' | 'AFTER',
  index: number,
  beforeCount: number,
  afterCount: number,
): OpenState {
  if (phase === 'BEFORE') {
    return {
      beforeIndex: index,
      afterIndex: afterCount > 0 ? Math.min(index, afterCount - 1) : 0,
    };
  }
  return {
    afterIndex: index,
    beforeIndex: beforeCount > 0 ? Math.min(index, beforeCount - 1) : 0,
  };
}
