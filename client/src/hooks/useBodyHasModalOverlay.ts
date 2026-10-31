import { useSyncExternalStore } from 'react';

/** FAB가 직접 연 시트는 플로팅 버튼을 숨기지 않는다. 시트가 버튼 위를 덮는다. */
const MODAL_OVERLAY_SELECTOR =
  '.modal-mobile-safe-overlay:not([data-fab-sheet]), [role="dialog"][aria-modal="true"]:not([data-fab-sheet])';

function overlayOpen(): boolean {
  return document.querySelector(MODAL_OVERLAY_SELECTOR) != null;
}

function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'role', 'aria-modal', 'hidden', 'data-fab-sheet'],
  });
  return () => observer.disconnect();
}

/** 모달·하단 시트가 열려 있으면 true. 모바일 우측 플로팅 버튼을 그 아래로 내린다. */
export function useBodyHasModalOverlay(): boolean {
  return useSyncExternalStore(subscribe, overlayOpen, () => false);
}
