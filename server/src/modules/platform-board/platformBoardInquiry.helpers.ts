/**
 * 1:1 문의 — 입력 검사, 메일 제목 번호, 답장 본문 정리, 발신자 구분.
 * DB·네트워크를 쓰지 않는 순수 함수만 둔다(테스트 대상).
 */
import crypto from 'node:crypto';

export const INQUIRY_PRIVACY_CONSENT_VERSION = 'inquiry-2026-11-11';
export const MAX_NOTIFY_EMAILS = 10;

/** 화면·서버가 같이 쓰는 칸 이름 */
export type InquiryField =
  | 'categoryId'
  | 'authorName'
  | 'authorPhone'
  | 'authorEmail'
  | 'title'
  | 'bodyHtml'
  | 'privacyConsent';

export const INQUIRY_FIELD_MESSAGES: Record<InquiryField, string> = {
  categoryId: '문의 종류를 골라 주세요.',
  authorName: '이름을 적어 주세요.',
  authorPhone: '휴대폰 번호를 010-0000-0000 형식으로 적어 주세요.',
  authorEmail: '답변 받을 이메일 주소를 확인해 주세요.',
  title: '제목을 적어 주세요.',
  bodyHtml: '문의 내용을 적어 주세요.',
  privacyConsent: '개인정보 수집·이용에 동의해 주세요.',
};

export class InquiryValidationError extends Error {
  readonly field: InquiryField;
  constructor(field: InquiryField) {
    super('VALIDATION');
    this.field = field;
  }
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;

export function isValidEmail(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  return s.length <= 256 && EMAIL_RE.test(s);
}

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

/** 01X로 시작하는 10~11자리 → 010-1234-5678. 아니면 null */
export function normalizeKrMobile(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(digits)) return null;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 헷갈리는 0·O·1·I 를 뺀 글자 */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REPLY_TOKEN_LENGTH = 6;

export function generateReplyToken(length = REPLY_TOKEN_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TOKEN_ALPHABET[crypto.randomInt(TOKEN_ALPHABET.length)];
  }
  return out;
}

/** 제목에서 #K7Q2X9 를 찾는다(대소문자 무관) */
export function extractReplyToken(subject: unknown): string | null {
  const m = /#([A-HJ-NP-Z2-9]{6})(?![A-Za-z0-9])/i.exec(String(subject ?? ''));
  return m ? m[1]!.toUpperCase() : null;
}

export function inquiryMessageId(postId: string): string {
  return `<inquiry-${postId}@cbiseo.com>`;
}

export function inquirySubject(token: string, title: string): string {
  return `[청소비서 문의 #${token}] ${title}`;
}

/** 게시판 설정의 notifyEmails(없으면 예전 notifyEmail 하나) → 정리된 배열 */
export function parseNotifyEmails(raw: { notifyEmails?: unknown; notifyEmail?: unknown }): string[] {
  const list: unknown[] = Array.isArray(raw.notifyEmails)
    ? raw.notifyEmails
    : typeof raw.notifyEmail === 'string'
      ? [raw.notifyEmail]
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const e = String(item ?? '').trim();
    if (!isValidEmail(e)) continue;
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= MAX_NOTIFY_EMAILS) break;
  }
  return out;
}

export type InquirySenderKind = 'ADMIN' | 'CUSTOMER' | 'UNKNOWN';

/** 담당자 메일이 먼저, 그다음 문의 작성자. 그 밖은 모르는 발신자 */
export function classifyInquirySender(
  fromEmail: string | null | undefined,
  notifyEmails: string[],
  authorEmail: string | null | undefined,
): InquirySenderKind {
  const from = normalizeEmail(fromEmail);
  if (!from) return 'UNKNOWN';
  if (notifyEmails.some((e) => normalizeEmail(e) === from)) return 'ADMIN';
  if (authorEmail && normalizeEmail(authorEmail) === from) return 'CUSTOMER';
  return 'UNKNOWN';
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (m, code: string) => {
    const lower = code.toLowerCase();
    if (ENTITY_MAP[lower] !== undefined) return ENTITY_MAP[lower]!;
    if (lower.startsWith('#x')) {
      const n = parseInt(lower.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    if (lower.startsWith('#')) {
      const n = parseInt(lower.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

/** HTML 메일 → 줄바꿈만 살린 글. 스크립트·스타일·이미지는 버린다 */
export function htmlToPlainText(html: unknown): string {
  let s = String(html ?? '');
  s = s.replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // 인용 블록은 줄마다 > 를 붙여 아래 잘라내기 규칙에 걸리게 한다
  s = s.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, (block) =>
    '\n' +
    htmlToPlainText(block.replace(/^<blockquote[^>]*>|<\/blockquote>$/gi, ''))
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n') +
    '\n',
  );
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const QUOTE_START_PATTERNS: RegExp[] = [
  /^-{2,}\s*Original Message\s*-{2,}/i,
  /^-{2,}\s*원본 메시지\s*-{2,}/,
  /^-{2,}\s*Forwarded message\s*-{2,}/i,
  /^On .+wrote:\s*$/i,
  /^20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\..*작성:?\s*$/,
  /^20\d{2}년\s*\d{1,2}월\s*\d{1,2}일.*작성:?\s*$/,
  /^(보낸 사람|From)\s*:/i,
  /^>/,
];

/**
 * 답장 메일에서 새로 쓴 부분만 남긴다.
 * 인용 머리줄·> 줄·원본 메시지 구분선 앞까지, 서명(`-- `) 아래는 버린다.
 */
export function stripQuotedReply(text: unknown): string {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const t = line.trim();
    if (line === '-- ' || t === '--') break;
    if (QUOTE_START_PATTERNS.some((re) => re.test(t))) break;
    // Gmail: "On Tue, ... <a@b.com>" 다음 줄에 "wrote:" 가 오는 경우
    if (/^On .+/i.test(t) && /wrote:\s*$/i.test((lines[i + 1] ?? '').trim())) break;
    kept.push(line);
  }
  return kept
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 글 → 안전한 HTML(줄바꿈만 살림) */
export function plainTextToSafeHtml(text: string): string {
  const paras = text.trim().split(/\n{2,}/);
  return paras
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/** 메일 주소 도메인으로 IMAP 서버 기본값 */
export function defaultImapHostForEmail(email: unknown): string | null {
  const domain = String(email ?? '').trim().toLowerCase().split('@')[1] ?? '';
  if (domain === 'naver.com') return 'imap.naver.com';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'imap.gmail.com';
  if (domain === 'daum.net' || domain === 'hanmail.net') return 'imap.daum.net';
  return null;
}

/** 문의 등록 입력 검사 — 실패하면 InquiryValidationError(칸 이름) */
export function validateInquiryInput(input: {
  categoryId?: unknown;
  authorName?: unknown;
  authorPhone?: unknown;
  authorEmail?: unknown;
  title?: unknown;
  bodyText?: unknown;
  privacyConsent?: unknown;
  consentVersion?: unknown;
}): { authorName: string; authorPhone: string; authorEmail: string; title: string } {
  if (!String(input.categoryId ?? '').trim()) throw new InquiryValidationError('categoryId');
  const authorName = String(input.authorName ?? '').trim().slice(0, 64);
  if (!authorName) throw new InquiryValidationError('authorName');
  const authorPhone = normalizeKrMobile(input.authorPhone);
  if (!authorPhone) throw new InquiryValidationError('authorPhone');
  const authorEmail = String(input.authorEmail ?? '').trim();
  if (!isValidEmail(authorEmail)) throw new InquiryValidationError('authorEmail');
  const title = String(input.title ?? '').trim().slice(0, 256);
  if (!title) throw new InquiryValidationError('title');
  if (!String(input.bodyText ?? '').trim()) throw new InquiryValidationError('bodyHtml');
  if (input.privacyConsent !== true || !String(input.consentVersion ?? '').trim()) {
    throw new InquiryValidationError('privacyConsent');
  }
  return { authorName, authorPhone, authorEmail, title };
}
