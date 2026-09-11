import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const CHUNK_RELOAD_SESSION_KEY = 'skcleantec:chunk-reload';

function errorText(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name} ${err.message} ${err.stack ?? ''}`;
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybe = err as { message?: unknown };
    if (typeof maybe.message === 'string') return maybe.message;
    try {
      return String(err);
    } catch {
      return '';
    }
  }
  return String(err ?? '');
}

export function isChunkLoadError(err: unknown): boolean {
  const msg = errorText(err).toLowerCase();
  if (!msg.trim()) return false;
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('failed to load module script') ||
    msg.includes('module script') ||
    msg.includes('unable to preload') ||
    msg.includes('preload css') ||
    msg.includes('error loading css')
  );
}

/** 배포 직후 옛 청크 404 — 세션당 1회만 같은 URL로 reload. 이미 했으면 false. */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/** 기동 성공 후 가드를 지워 다음 배포에서도 1회 자동 reload가 되게 한다. 연속 reload만 막기 위해 짧게 지연. */
export function scheduleClearChunkReloadGuard(delayMs = 2500): void {
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, delayMs);
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
      if (isChunkLoadError(err) && reloadOnceForStaleChunk()) {
        return new Promise(() => undefined);
      }
      throw err;
    }
  });
}
