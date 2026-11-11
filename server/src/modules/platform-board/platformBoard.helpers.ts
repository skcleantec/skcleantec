import { stripDangerousHtml } from '../help-cms/helpCms.helpers.js';
import { parseNotifyEmails } from './platformBoardInquiry.helpers.js';

export type PlatformBoardReplyInboxPublic = {
  email: string;
  host: string;
  port: number;
  /** 비밀번호는 내보내지 않는다 */
  passwordConfigured: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type PlatformBoardSettings = {
  /** 예전 단일 알림 메일 — notifyEmails 첫 칸과 같다 */
  notifyEmail?: string;
  /** 문의 알림 받을 메일(최대 10) */
  notifyEmails: string[];
  contactEmail?: string;
  composeHelpText?: string | null;
  maskAuthorNames?: boolean;
  /** 답장 받는 메일함(IMAP) */
  replyInbox: PlatformBoardReplyInboxPublic | null;
};

/** DB에 저장된 답장 메일함(암호화된 앱 비밀번호 포함) — 서버 안에서만 */
export type PlatformBoardReplyInboxStored = {
  email: string;
  host: string;
  port: number;
  passEnc?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
};

export function parseReplyInboxStored(raw: unknown): PlatformBoardReplyInboxStored | null {
  if (!raw || typeof raw !== 'object') return null;
  const settings = raw as Record<string, unknown>;
  const box = settings.replyInbox;
  if (!box || typeof box !== 'object') return null;
  const o = box as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email.trim() : '';
  const host = typeof o.host === 'string' ? o.host.trim() : '';
  if (!email || !host) return null;
  const port = typeof o.port === 'number' && o.port > 0 ? o.port : 993;
  return {
    email,
    host,
    port,
    passEnc: typeof o.passEnc === 'string' && o.passEnc ? o.passEnc : undefined,
    lastSyncAt: typeof o.lastSyncAt === 'string' ? o.lastSyncAt : null,
    lastError: typeof o.lastError === 'string' ? o.lastError : null,
  };
}

export function parseBoardSettings(raw: unknown): PlatformBoardSettings {
  if (!raw || typeof raw !== 'object') return { notifyEmails: [], replyInbox: null };
  const o = raw as Record<string, unknown>;
  const notifyEmails = parseNotifyEmails(o);
  const inbox = parseReplyInboxStored(raw);
  return {
    notifyEmail: notifyEmails[0],
    notifyEmails,
    contactEmail: typeof o.contactEmail === 'string' ? o.contactEmail : undefined,
    composeHelpText: typeof o.composeHelpText === 'string' ? o.composeHelpText : null,
    maskAuthorNames: o.maskAuthorNames !== false,
    replyInbox: inbox
      ? {
          email: inbox.email,
          host: inbox.host,
          port: inbox.port,
          passwordConfigured: Boolean(inbox.passEnc),
          lastSyncAt: inbox.lastSyncAt ?? null,
          lastError: inbox.lastError ?? null,
        }
      : null,
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

/** 한글만 있는 카테고리명도 저장되게 — ASCII가 없으면 자동 슬러그 */
export function slugFromCategoryLabel(label: string): string {
  const ascii = normalizeBoardSlug(label);
  if (ascii) return ascii;
  return `cat-${Date.now().toString(36)}`;
}

export function sanitizeBoardBodyHtml(html: string): string {
  return stripDangerousHtml(String(html ?? '').trim());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    const safe = String(url).replace(/"/g, '');
    return `<img src="${safe}" alt="${escapeHtml(String(alt))}" />`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const safe = String(url).replace(/"/g, '');
    return `<a href="${safe}" rel="noopener noreferrer">${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

/** 게시 API 미러 — 굵게·제목·목록·표·이미지를 HTML로 */
export function markdownWithImagesToHtml(bodyMarkdown: string, imageUrls: string[]): string {
  const lines = String(bodyMarkdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const parts: string[] = [];
  let i = 0;
  let listBuf: string[] = [];
  let tableBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    parts.push(`<ul>${listBuf.map((li) => `<li>${inlineMarkdown(li)}</li>`).join('')}</ul>`);
    listBuf = [];
  };
  const flushTable = () => {
    if (tableBuf.length === 0) return;
    const rows = tableBuf
      .filter((row) => !/^\s*\|?\s*:?-{3,}/.test(row.replace(/\|/g, '|')))
      .map((row) => {
        const cells = row
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        return cells;
      })
      .filter((cells) => cells.some((c) => c.length > 0));
    if (rows.length === 0) {
      tableBuf = [];
      return;
    }
    const [head, ...body] = rows;
    const thead = `<thead><tr>${head.map((c) => `<th>${inlineMarkdown(c)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${body
      .map((r) => `<tr>${r.map((c) => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody>`;
    parts.push(`<table>${thead}${tbody}</table>`);
    tableBuf = [];
  };

  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const t = raw.trim();
    if (!t) {
      flushList();
      flushTable();
      i += 1;
      continue;
    }
    if (t.includes('|') && (t.startsWith('|') || t.includes('|'))) {
      flushList();
      tableBuf.push(t);
      i += 1;
      continue;
    }
    if (tableBuf.length) flushTable();

    const heading = /^(#{1,3})\s+(.+)$/.exec(t);
    if (heading) {
      flushList();
      const level = heading[1].length;
      parts.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(t);
    if (bullet) {
      listBuf.push(bullet[1]);
      i += 1;
      continue;
    }

    flushList();
    parts.push(`<p>${inlineMarkdown(t)}</p>`);
    i += 1;
  }
  flushList();
  flushTable();

  for (const url of imageUrls) {
    if (typeof url === 'string' && url.trim()) {
      parts.push(`<p><img src="${escapeHtml(url.trim())}" alt="" /></p>`);
    }
  }
  return parts.length > 0 ? sanitizeBoardBodyHtml(parts.join('')) : '<p></p>';
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
    case 'DUPLICATE_CATEGORY':
      return { status: 409, error: '같은 카테고리가 이미 있습니다. 다른 이름을 써 주세요.' };
    case 'FILE_TYPE':
      return { status: 400, error: '올릴 수 있는 파일 형식이 아닙니다.' };
    case 'ACCESS_DENIED':
      return { status: 403, error: '열람 권한이 없습니다.' };
    case 'CONTENT_REQUIRED':
      return { status: 400, error: '본문을 입력해 주세요.' };
    case 'INVALID_NOTIFY_EMAIL':
      return { status: 400, error: '알림 받을 메일 주소를 확인해 주세요.' };
    case 'TOO_MANY_NOTIFY_EMAILS':
      return { status: 400, error: '알림 받을 메일은 10개까지 넣을 수 있어요.' };
    case 'INVALID_INBOX_EMAIL':
      return { status: 400, error: '답장 받는 메일 주소를 확인해 주세요.' };
    case 'INVALID_INBOX_HOST':
      return { status: 400, error: 'IMAP 서버 주소를 넣어 주세요.' };
    default:
      return { status: 500, error: '처리 중 오류가 발생했습니다.' };
  }
}
