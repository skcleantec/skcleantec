/**
 * fetch 실패 시 원인 구분 — 브라우저·OS별로 던지는 예외 형태가 달라 휴리스틱으로 판별합니다.
 * (과거: 모든 TypeError를 네트워크로 간주 → 잘못된 안내 가능)
 */
export function isLikelyNetworkFailure(e: unknown): boolean {
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    if (e.name === 'AbortError') return false;
    return e.name === 'NetworkError' || e.name === 'TimeoutError';
  }
  if (e instanceof TypeError) {
    const m = (e.message || '').toLowerCase();
    return (
      m.includes('failed to fetch') ||
      m.includes('load failed') ||
      m.includes('networkerror') ||
      m.includes('failed to load') ||
      m.includes('ecconnrefused') ||
      m.includes('enotfound') ||
      m.includes('network request failed')
    );
  }
  if (e instanceof Error) {
    return /Failed to fetch|NetworkError|Load failed|ECONNREFUSED|ENOTFOUND|socket hang up|network request failed/i.test(
      e.message
    );
  }
  return false;
}
