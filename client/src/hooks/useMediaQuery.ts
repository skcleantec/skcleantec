import { useSyncExternalStore } from 'react';

/** Tailwind `lg` — 1024px 이상 */
export const LG_MIN_WIDTH_MQ = '(min-width: 1024px)';

function subscribeMediaQuery(query: string, onStoreChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (cb) => subscribeMediaQuery(query, cb),
    () => window.matchMedia(query).matches,
    () => serverFallback
  );
}

/** PC 넓은 레이아웃(테이블·데스크톱 GNB) 여부 */
export function useIsLgUp(): boolean {
  return useMediaQuery(LG_MIN_WIDTH_MQ);
}
