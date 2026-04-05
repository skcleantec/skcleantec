/**
 * 기본: `/api` (Vite 개발 서버가 3000으로 프록시).
 * Cursor Simple Browser 등에서 프록시가 동작하지 않을 때는 `.env.development`의
 * `VITE_API_PREFIX`로 API에 직접 접속합니다. (서버 CORS: origin 허용)
 */
export const API_PREFIX = (() => {
  const raw = import.meta.env.VITE_API_PREFIX as string | undefined;
  if (raw && raw.trim()) return raw.replace(/\/$/, '');
  return '/api';
})();

export async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  const e = data.error;
  if (typeof e === 'string' && e.trim()) return e.trim();
  if (res.status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (res.status === 403) return '이 기능에 접근할 권한이 없습니다.';
  return `${fallback} (HTTP ${res.status})`;
}
