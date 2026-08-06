import { stripDangerousHtml } from '../help-cms/helpCms.helpers.js';

export type PlatformBoardSettings = {
  notifyEmail?: string;
  contactEmail?: string;
  composeHelpText?: string | null;
  maskAuthorNames?: boolean;
};

export function parseBoardSettings(raw: unknown): PlatformBoardSettings {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    notifyEmail: typeof o.notifyEmail === 'string' ? o.notifyEmail : undefined,
    contactEmail: typeof o.contactEmail === 'string' ? o.contactEmail : undefined,
    composeHelpText: typeof o.composeHelpText === 'string' ? o.composeHelpText : null,
    maskAuthorNames: o.maskAuthorNames !== false,
  };
}

/** 작성자 이름 마스킹 — 목록 공개 시 */
export function maskAuthorName(name: string | null | undefined): string {
  const t = String(name ?? '').trim();
  if (!t) return '익명';
  if (t.length <= 1) return '*';
  if (t.length === 2) return `${t[0]}*`;
  return `${t[0]}${'*'.repeat(Math.min(t.length - 2, 4))}${t[t.length - 1]}`;
}

export function normalizeBoardSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return s.length > 0 ? s : null;
}

export function sanitizeBoardBodyHtml(html: string): string {
  return stripDangerousHtml(String(html ?? '').trim());
}

export function markdownWithImagesToHtml(bodyMarkdown: string, imageUrls: string[]): string {
  const lines = bodyMarkdown.split('\n');
  const parts: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const escaped = t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    parts.push(`<p>${escaped}</p>`);
  }
  for (const url of imageUrls) {
    if (typeof url === 'string' && url.trim()) {
      parts.push(`<p><img src="${url.trim()}" alt="" /></p>`);
    }
  }
  return parts.length > 0 ? parts.join('') : '<p></p>';
}

export function mapBoardError(msg: string): { status: number; error: string } {
  switch (msg) {
    case 'NOT_FOUND':
      return { status: 404, error: '항목을 찾을 수 없습니다.' };
    case 'BOARD_NOT_FOUND':
      return { status: 404, error: '게시판을 찾을 수 없습니다.' };
    case 'INVALID_CATEGORY':
      return { status: 400, error: '카테고리를 확인해 주세요.' };
    case 'VALIDATION':
      return { status: 400, error: '입력 내용을 확인해 주세요.' };
    case 'ACCESS_DENIED':
      return { status: 403, error: '열람 권한이 없습니다.' };
    case 'CONTENT_REQUIRED':
      return { status: 400, error: '본문을 입력해 주세요.' };
    default:
      return { status: 500, error: '처리 중 오류가 발생했습니다.' };
  }
}
