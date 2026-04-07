import { useEffect, useRef } from 'react';

/**
 * 브라우저 탭이 보일 때만 주기 실행(백그라운드 탭에서 불필요한 API·DB 부하 방지).
 * 탭 복귀 시 즉시 한 번 실행 후 인터벌 재개.
 * `intervalMs <= 0` 이면 주기 없음(웹소켓 등으로 갱신할 때 폴링 끔). 마운트·탭 복귀 시에만 실행.
 */
export function useVisibilityInterval(callback: () => void, intervalMs: number) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') cbRef.current();
    };
    tick();
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const syncInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      if (document.visibilityState !== 'visible') return;
      if (intervalMs > 0) {
        intervalId = setInterval(tick, intervalMs);
      }
    };
    syncInterval();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
        syncInterval();
      } else if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalMs]);
}
