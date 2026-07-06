import { useEffect, useRef } from 'react';

/**
 * 메시지 스레드 폴링(탭이 보일 때만). 백그라운드에서는 호출 생략.
 */
export function useMessageThreadPoll(enabled: boolean, tick: () => void, intervalMs = 3000) {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === 'visible') tickRef.current();
    };
    run();
    const id = setInterval(run, intervalMs);
    const onVis = () => {
      if (document.visibilityState === 'visible') tickRef.current();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, intervalMs]);
}
