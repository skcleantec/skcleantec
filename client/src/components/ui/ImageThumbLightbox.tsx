import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../admin/ModalCloseButton';

export type ImageGallerySlide = { src: string; alt: string };

type Props = {
  src: string;
  alt?: string;
  thumbClassName?: string;
  buttonClassName?: string;
  /** 2장 이상이면 확대 시 이전·다음 */
  gallerySlides?: ImageGallerySlide[];
  /** gallerySlides에서 현재 썸네일 인덱스 */
  galleryIndex?: number;
};

/**
 * 업로드 이미지 썸네일 + 탭 시 전체 화면(라이트박스).
 * gallerySlides가 여러 장이면 좌우 버튼·키보드(←→)로 이동.
 */
export function ImageThumbLightbox({
  src,
  alt = '',
  thumbClassName = 'h-8 w-full object-cover',
  buttonClassName =
    'block w-full overflow-hidden rounded border border-gray-200 bg-gray-50 p-0 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation',
  gallerySlides,
  galleryIndex = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const slides: ImageGallerySlide[] =
    gallerySlides && gallerySlides.length > 0 ? gallerySlides : [{ src, alt: alt || '이미지' }];
  const multi = slides.length > 1;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (!multi) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + slides.length) % slides.length);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % slides.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, multi, slides.length]);

  const current = slides[open ? activeIndex : 0] ?? { src, alt: alt || '' };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (multi) {
            setActiveIndex(Math.min(Math.max(0, galleryIndex), slides.length - 1));
          } else {
            setActiveIndex(0);
          }
          setOpen(true);
        }}
        className={buttonClassName}
        aria-label={alt || '이미지 크게 보기'}
      >
        <img src={src} alt="" className={thumbClassName} loading="lazy" />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[700] flex items-center justify-center bg-black/90 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            role="dialog"
            aria-modal="true"
            aria-label={current.alt || '이미지 보기'}
            onClick={() => setOpen(false)}
          >
            <img
              src={current.src}
              alt={current.alt}
              className="relative z-0 max-h-[min(92dvh,100%)] max-w-full object-contain touch-manipulation select-none"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
            <ModalCloseButton onClick={() => setOpen(false)} className="right-2 top-2 z-[750] sm:right-4 sm:top-4" />
            {multi && (
              <>
                <button
                  type="button"
                  className="absolute left-1 top-1/2 z-[750] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg touch-manipulation hover:bg-black/70 sm:left-3"
                  aria-label="이전 이미지"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((i) => (i - 1 + slides.length) % slides.length);
                  }}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    ‹
                  </span>
                </button>
                <button
                  type="button"
                  className="absolute right-1 top-1/2 z-[750] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg touch-manipulation hover:bg-black/70 sm:right-3"
                  aria-label="다음 이미지"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((i) => (i + 1) % slides.length);
                  }}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    ›
                  </span>
                </button>
                <div className="absolute bottom-3 left-1/2 z-[750] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-fluid-xs text-white tabular-nums">
                  {activeIndex + 1} / {slides.length}
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
