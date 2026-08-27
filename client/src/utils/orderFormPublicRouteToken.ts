/** 발주서 공개 URL path/query 토큰 — 24자 hex (randomBytes(12)) */
const ORDER_FORM_TOKEN_RE = /^[a-f0-9]{24}$/i;

export function isValidOrderFormPublicToken(raw: string | null | undefined): boolean {
  const s = raw?.trim() ?? '';
  return ORDER_FORM_TOKEN_RE.test(s);
}

/** 카카오 WL `#` 파싱 오류 등 — query·hash에서 토큰 복구 */
export function resolveOrderFormTokenFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  for (const key of ['t', 'token']) {
    const v = params.get(key)?.trim();
    if (v && isValidOrderFormPublicToken(v)) return v;
  }

  const hash = window.location.hash.replace(/^#/, '').trim();
  const fromHash = /^([a-f0-9]{24})/i.exec(hash);
  if (fromHash?.[1]) return fromHash[1];

  return null;
}

export function normalizeOrderFormRouteToken(raw: string | null | undefined): string | null {
  const s = raw?.trim() ?? '';
  if (!s) return null;
  if (isValidOrderFormPublicToken(s)) return s;
  if (s.includes('#{') || s.includes('{')) return null;
  return null;
}
