import { useSyncExternalStore } from 'react';

function overlayOpen(): boolean {
  return document.querySelector('.modal-mobile-safe-overlay, [role="dialog"][aria-modal="true"]') != null;
}

function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'role', 'aria-modal', 'hidden'],
  });
  return () => observer.disconnect();
}

/** 모달·하단 시트가 열려 있으면 true. 모바일 우측 플로팅 버튼을 그 아래로 내린다. */
export function useBodyHasModalOverlay(): boolean {
  return useSyncExternalStore(subscribe, overlayOpen, () => false);
}
