import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InspectionAreaPhoto, InspectionChecklistDto } from '../../api/inquiryInspection';
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

export type InspectionCompareSlide = {
  itemId: string;
  areaLabel: string;
  itemLabel: string;
  beforePhotos: InspectionAreaPhoto[];
  afterPhotos: InspectionAreaPhoto[];
};

export type ComparePhotoInitial = {
  beforeIndex: number;
  afterIndex: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  slides: InspectionCompareSlide[];
  slideIndex: number;
  onSlideIndexChange: (index: number) => void;
  initial?: ComparePhotoInitial;
};

export function buildInspectionCompareSlides(checklist: InspectionChecklistDto): InspectionCompareSlide[] {
  const out: InspectionCompareSlide[] = [];
  for (const area of checklist.areas) {
    if (area.notApplicable) continue;
    for (const item of area.items) {
      if (item.itemKey.startsWith('_') || item.notApplicable) continue;
      out.push({
        itemId: item.id,
        areaLabel: area.label,
        itemLabel: item.label,
        beforePhotos: item.photos.filter((p) => p.phase === 'BEFORE'),
        afterPhotos: item.photos.filter((p) => p.phase === 'AFTER'),
      });
    }
  }
  return out;
}

function NavCircleButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-xl font-light text-slate-800 shadow-md touch-manipulation hover:border-slate-400 hover:bg-slate-50 active:scale-95 ${className}`}
    >
      <span aria-hidden>{label.includes('이전') ? '‹' : '›'}</span>
    </button>
  );
}

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
    tone === 'before'
      ? 'border-sky-200 bg-sky-50 text-sky-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';

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
      <div className={`shrink-0 border-b px-2 py-2 text-center text-xs font-semibold ${headerCls}`}>
        {label}
        {photos.length > 0 ? (
          <span className="ml-1 font-normal text-slate-600">
            ({index + 1}/{photos.length})
          </span>
        ) : null}
      </div>
      <div className="relative flex min-h-[12rem] min-w-0 flex-1 items-center justify-center bg-slate-100 p-2 sm:min-h-[16rem]">
        {photo ? (
          <img
            src={photo.secureUrl}
            alt={`${itemLabel} ${label}`}
            className="max-h-[min(52dvh,100%)] max-w-full object-contain select-none"
            draggable={false}
          />
        ) : (
          <p className="text-sm text-slate-400">사진 없음</p>
        )}
        {multi && photo ? (
          <>
            <button
              type="button"
              className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-800 shadow touch-manipulation hover:bg-slate-50"
              aria-label={`${label} 이전 사진`}
              onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-800 shadow touch-manipulation hover:bg-slate-50"
              aria-label={`${label} 다음 사진`}
              onClick={() => onIndexChange((index + 1) % photos.length)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-white p-2">
        <button
          type="button"
          disabled={!photo || downloadBusy}
          onClick={() => void handleDownload()}
          className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 touch-manipulation hover:bg-slate-50 disabled:opacity-40"
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
  slides,
  slideIndex,
  onSlideIndexChange,
  initial,
}: Props) {
  const slide = slides[slideIndex];
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);

  useEffect(() => {
    if (!open || !slide) return;
    const b = initial?.beforeIndex ?? 0;
    const a = initial?.afterIndex ?? 0;
    setBeforeIndex(slide.beforePhotos.length ? Math.min(b, slide.beforePhotos.length - 1) : 0);
    setAfterIndex(slide.afterPhotos.length ? Math.min(a, slide.afterPhotos.length - 1) : 0);
  }, [
    open,
    slide?.itemId,
    initial?.beforeIndex,
    initial?.afterIndex,
    slide?.beforePhotos.length,
    slide?.afterPhotos.length,
  ]);

  const goPrevItem = () => {
    if (slides.length <= 1) return;
    onSlideIndexChange((slideIndex - 1 + slides.length) % slides.length);
  };

  const goNextItem = () => {
    if (slides.length <= 1) return;
    onSlideIndexChange((slideIndex + 1) % slides.length);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (slides.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevItem();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNextItem();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, slideIndex, slides.length]);

  if (!open || !slide) return null;

  const titleLine = slide.areaLabel ? `${slide.areaLabel} · ${slide.itemLabel}` : slide.itemLabel;

  return createPortal(
    <div
      className="fixed inset-0 z-[720] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${titleLine} 검수 사진`}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[min(100%,56rem)] items-stretch gap-1 sm:gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {slides.length > 1 ? (
          <div className="hidden shrink-0 items-center sm:flex">
            <NavCircleButton label="이전 항목" onClick={goPrevItem} className="" />
          </div>
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-2xl">
          <ModalCloseButton onClick={onClose} className="right-2 top-2 z-20 sm:right-3 sm:top-3" />

          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 pt-10 text-center sm:px-4">
            <p className="truncate text-sm font-semibold text-slate-900">{titleLine}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              왼쪽 청소 전 · 오른쪽 청소 후
              {slides.length > 1 ? (
                <span className="ml-1.5 tabular-nums text-slate-500">
                  · 항목 {slideIndex + 1}/{slides.length}
                </span>
              ) : null}
            </p>
            {slides.length > 1 ? (
              <div className="mt-2 flex items-center justify-center gap-2 sm:hidden">
                <NavCircleButton label="이전 항목" onClick={goPrevItem} className="!h-9 !w-9 !text-base" />
                <span className="text-fluid-2xs tabular-nums text-slate-600">
                  {slideIndex + 1} / {slides.length}
                </span>
                <NavCircleButton label="다음 항목" onClick={goNextItem} className="!h-9 !w-9 !text-base" />
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-200 sm:flex-row sm:divide-x sm:divide-y-0">
            <PhotoPane
              label="청소 전"
              tone="before"
              photos={slide.beforePhotos}
              index={beforeIndex}
              onIndexChange={setBeforeIndex}
              itemLabel={slide.itemLabel}
              phaseTag="before"
            />
            <PhotoPane
              label="청소 후"
              tone="after"
              photos={slide.afterPhotos}
              index={afterIndex}
              onIndexChange={setAfterIndex}
              itemLabel={slide.itemLabel}
              phaseTag="after"
            />
          </div>
        </div>

        {slides.length > 1 ? (
          <div className="hidden shrink-0 items-center sm:flex">
            <NavCircleButton label="다음 항목" onClick={goNextItem} className="" />
          </div>
        ) : null}
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
): ComparePhotoInitial {
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
