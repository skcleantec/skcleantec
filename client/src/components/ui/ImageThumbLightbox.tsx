import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../admin/ModalCloseButton';

type Props = {
  src: string;
  alt?: string;
  /** 썸네일 `<img>` 클래스 (기본: 작은 높이·가로 채움) */
  thumbClassName?: string;
  /** 썸네일을 감싸는 버튼 클래스 */
  buttonClassName?: string;
};

/**
 * 업로드 이미지 썸네일 + 탭 시 전체 화면(라이트박스).
 * 팝업 `window.open` 없이 같은 문서에서만 동작.
 */
export function ImageThumbLightbox({
  src,
  alt = '',
  thumbClassName = 'h-8 w-full object-cover',
  buttonClassName =
    'block w-full overflow-hidden rounded border border-gray-200 bg-gray-50 p-0 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation',
}: Props) {
  const [open, setOpen] = useState(false);

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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
            aria-label={alt || '이미지 보기'}
            onClick={() => setOpen(false)}
          >
            <ModalCloseButton onClick={() => setOpen(false)} className="right-2 top-2 sm:right-4 sm:top-4" />
            <img
              src={src}
              alt={alt}
              className="max-h-[min(92dvh,100%)] max-w-full object-contain touch-manipulation select-none"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}
