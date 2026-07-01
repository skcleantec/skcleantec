/** 첫 페인트·핵심 API 이후 무거운 요청을 미룸 */
export function runWhenIdle(fn: () => void, timeoutMs = 2500): () => void {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 400);
  return () => window.clearTimeout(id);
}
