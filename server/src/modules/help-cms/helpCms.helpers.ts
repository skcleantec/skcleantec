const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAB_GROUPS = new Set(['usage', 'notice']);
const CONTENT_FORMATS = new Set(['html', 'markdown']);

export type HelpCmsContentFormat = 'html' | 'markdown';

export function parseHelpCmsContentFormat(raw: unknown): HelpCmsContentFormat {
  if (typeof raw !== 'string') return 'html';
  const v = raw.trim().toLowerCase();
  return CONTENT_FORMATS.has(v) ? (v as HelpCmsContentFormat) : 'html';
}

export function normalizeHelpCmsSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  if (!s || !SLUG_RE.test(s)) return null;
  return s;
}

export function slugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  if (base && SLUG_RE.test(base)) return base;
  const ascii = normalizeHelpCmsSlug(title);
  return ascii ?? `article-${Date.now()}`;
}

export function parseHelpCmsTabGroup(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return TAB_GROUPS.has(v) ? v : null;
}

/** 에디터 사진 크기 메뉴가 본문에 섞인 경우 제거 (저장·표시 공통) */
export function stripImageResizeUiFromHtml(html: string): string {
  return html
    .replace(/<div[^>]*(?:data-img-resize-ui|cbiseo-img-resize-ui)[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/작게\s*절반\s*크게\s*가득\s*사진 바꾸기/g, '');
}

export function stripDangerousHtml(html: string): string {
  return stripImageResizeUiFromHtml(html)
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}
