import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const CHUNK_RELOAD_SESSION_KEY = 'skcleantec:chunk-reload';

export function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('importing a module script failed') ||
    msg.includes('dynamically imported module')
  );
}

/** 배포 직후 index.html·청크 해시 불일치 시 1회 자동 새로고침 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React lazy()와 동일한 props 완화
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err) && !sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, String(Date.now()));
        window.location.reload();
        return new Promise(() => undefined);
      }
      throw err;
    }
  });
}
