import { useEffect } from 'react';

let lockCount = 0;
let savedOverflow = '';
let savedTouchAction = '';

/**
 * 모달·드로어 열림 시 배경(main/body) 스크롤을 잠근다.
 * 중첩 모달은 refcount로 한 번만 해제한다.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      savedTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
        document.body.style.touchAction = savedTouchAction;
      }
    };
  }, [active]);
}
