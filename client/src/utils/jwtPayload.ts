/** 브라우저에서 JWT 페이로드만 디코드 (서명 검증 없음). UI 표시용. */
export function parseJwtPayload<T extends Record<string, unknown>>(token: string): T | null {
  try {
    const seg = token.split('.')[1];
    if (!seg) return null;
    const json = atob(seg.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
