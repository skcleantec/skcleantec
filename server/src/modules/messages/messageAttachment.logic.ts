export const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const PDF_MAX_BYTES = 20 * 1024 * 1024;
export const IMAGE_MAX_COUNT = 30;
export const PDF_MAX_COUNT = 5;
export const ATTACHMENT_ORPHAN_MS = 24 * 60 * 60 * 1000;
export const NOTICE_REMIND_MS = 60 * 60 * 1000;
export const NOTICE_PAGE_SIZE = 30;

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export type UploadFileMeta = {
  originalname: string;
  mimetype: string;
  size: number;
};

export type UploadKind = 'image' | 'pdf';

export function fileExt(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function uploadKind(file: Pick<UploadFileMeta, 'originalname' | 'mimetype'>): UploadKind | null {
  const ext = fileExt(file.originalname);
  const mime = file.mimetype.toLowerCase().split(';')[0]?.trim() ?? '';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (IMAGE_EXT.has(ext) || IMAGE_MIME.has(mime)) return 'image';
  return null;
}

export function isHeic(file: Pick<UploadFileMeta, 'originalname' | 'mimetype'>): boolean {
  const ext = fileExt(file.originalname);
  const mime = file.mimetype.toLowerCase();
  return ext === 'heic' || ext === 'heif' || mime.includes('heic') || mime.includes('heif');
}

/** 장수·크기·형식. 사진과 PDF 한도를 각각 적용한다. */
export function validateUploadBatch(files: UploadFileMeta[]): string | null {
  if (files.length === 0) return '파일을 올려 주세요.';
  let images = 0;
  let pdfs = 0;
  for (const file of files) {
    const kind = uploadKind(file);
    if (!kind) return '사진(jpg, png, webp, heic)이나 PDF만 올릴 수 있어요.';
    if (kind === 'image') {
      images += 1;
      if (file.size > IMAGE_MAX_BYTES) return '사진은 한 장에 25MB까지예요.';
    } else {
      pdfs += 1;
      if (file.size > PDF_MAX_BYTES) return 'PDF는 한 개에 20MB까지예요.';
    }
  }
  if (images > IMAGE_MAX_COUNT) return '사진은 한 번에 30장까지예요.';
  if (pdfs > PDF_MAX_COUNT) return 'PDF는 한 번에 5개까지예요.';
  return null;
}

const FILE_NAME_MAX = 255;

/**
 * multipart 는 한글 이름을 latin1 로 넘긴다.
 * 이미 유니코드인 이름(한글이 그대로인 경우)은 다시 바꾸지 않는다.
 */
export function decodeUploadFileName(name: string): string {
  if (/[^\u0000-\u00ff]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  if (decoded.includes('\uFFFD')) return name;
  if (Buffer.from(decoded, 'utf8').toString('latin1') !== name) return name;
  return decoded;
}

export function safeFileName(name: string): string {
  const decoded = decodeUploadFileName(name);
  const base = (decoded.split(/[/\\]/).pop() ?? '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[/\\]/g, '')
    .trim();
  return clipFileName(base || 'file', FILE_NAME_MAX);
}

function clipFileName(name: string, max: number): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 && name.length - dot <= 16 ? name.slice(dot) : '';
  const stem = ext ? name.slice(0, dot) : name;
  const room = Math.max(1, max - ext.length);
  return `${stem.slice(0, room)}${ext}`;
}

export function normalizeAttachmentIds(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (out.length > IMAGE_MAX_COUNT + PDF_MAX_COUNT) return null;
  return out;
}

/** 글과 첨부가 둘 다 없으면 거절한다. */
export function messageBodyError(content: string, attachmentIds: string[]): string | null {
  if (!content.trim() && attachmentIds.length === 0) return '내용이나 사진·파일을 넣어 주세요.';
  return null;
}

export function messageListPreview(content: string, imageCount: number, fileCount: number): string {
  const head = content.replace(/\s+/g, ' ').trim();
  const tail: string[] = [];
  if (imageCount > 0) tail.push(`사진 ${imageCount}장`);
  if (fileCount > 0) tail.push(`파일 ${fileCount}개`);
  const suffix = tail.join(' · ');
  if (!head) return suffix;
  const clipped = head.length > 80 ? `${head.slice(0, 79)}…` : head;
  return suffix ? `${clipped} · ${suffix}` : clipped;
}

export function countAttachmentKinds(kinds: Array<'image' | 'pdf' | string>): { imageCount: number; fileCount: number } {
  let imageCount = 0;
  let fileCount = 0;
  for (const kind of kinds) {
    if (kind === 'image') imageCount += 1;
    else if (kind === 'pdf') fileCount += 1;
  }
  return { imageCount, fileCount };
}

export function isBroadcastNotice(input: { batchId: string | null; senderRole: string }): boolean {
  return Boolean(input.batchId) && (input.senderRole === 'ADMIN' || input.senderRole === 'MARKETER');
}

/** 사진·파일이 있는 공지는 열람 시각, 없는 공지는 대화방을 연 시각. */
export function noticeIsRead(input: {
  hasAttachments: boolean;
  readAt: Date | null;
  attachmentsViewedAt: Date | null;
}): boolean {
  if (input.hasAttachments) return input.attachmentsViewedAt != null;
  return input.readAt != null;
}

export function noticeReadAt(input: {
  hasAttachments: boolean;
  readAt: Date | null;
  attachmentsViewedAt: Date | null;
}): Date | null {
  if (!noticeIsRead(input)) return null;
  return input.hasAttachments ? input.attachmentsViewedAt : input.readAt;
}

export function deferReadUntilViewed(input: {
  batchId: string | null;
  senderRole: string;
  hasAttachments: boolean;
}): boolean {
  return isBroadcastNotice(input) && input.hasAttachments;
}

/** 공지 링크는 받는 사람 수와 상관없이 첨부 개수만큼만 만든다. */
export function linksForTarget(
  attachmentIds: string[],
  target: { batchId?: string; messageId?: string; crewNoticeBatchId?: string },
): Array<{ attachmentId: string; sortOrder: number; batchId: string | null; messageId: string | null; crewNoticeBatchId: string | null }> {
  const batchId = target.batchId ?? null;
  const messageId = target.messageId ?? null;
  const crewNoticeBatchId = target.crewNoticeBatchId ?? null;
  return attachmentIds.map((attachmentId, sortOrder) => ({
    attachmentId,
    sortOrder,
    batchId,
    messageId,
    crewNoticeBatchId,
  }));
}

export function missingAttachmentIds(requested: string[], ownedIds: string[]): string[] {
  const owned = new Set(ownedIds);
  return requested.filter((id) => !owned.has(id));
}

export function isOrphanAttachment(createdAt: Date, linkCount: number, now: Date): boolean {
  return linkCount === 0 && now.getTime() - createdAt.getTime() >= ATTACHMENT_ORPHAN_MS;
}

/** 남은 분. 다시 알릴 수 있으면 null. */
export function remindBlockMinutes(remindedAt: Date | null, now: Date): number | null {
  if (!remindedAt) return null;
  const left = NOTICE_REMIND_MS - (now.getTime() - remindedAt.getTime());
  if (left <= 0) return null;
  return Math.max(1, Math.ceil(left / 60_000));
}

export function pdfPageCount(buffer: Buffer): number | null {
  const text = buffer.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g);
  if (!matches || matches.length === 0) return null;
  return matches.length;
}

export function encodeNoticeCursor(createdAt: Date, batchId: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${batchId}`, 'utf8').toString('base64url');
}

export function decodeNoticeCursor(cursor: string): { createdAt: string; batchId: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const cut = raw.indexOf('|');
    if (cut <= 0) return null;
    const createdAt = raw.slice(0, cut);
    const batchId = raw.slice(cut + 1);
    if (!batchId || Number.isNaN(Date.parse(createdAt))) return null;
    return { createdAt, batchId };
  } catch {
    return null;
  }
}

export function pageAfterCursor<T extends { createdAt: Date; batchId: string }>(
  items: T[],
  cursor: string | null,
  pageSize = NOTICE_PAGE_SIZE,
): { page: T[]; nextCursor: string | null } {
  const sorted = [...items].sort((a, b) => {
    const delta = b.createdAt.getTime() - a.createdAt.getTime();
    if (delta !== 0) return delta;
    return b.batchId < a.batchId ? -1 : b.batchId > a.batchId ? 1 : 0;
  });
  let start = 0;
  if (cursor) {
    const decoded = decodeNoticeCursor(cursor);
    if (!decoded) return { page: [], nextCursor: null };
    const at = Date.parse(decoded.createdAt);
    start = sorted.findIndex((item) => {
      const time = item.createdAt.getTime();
      if (time < at) return true;
      if (time === at && item.batchId < decoded.batchId) return true;
      return false;
    });
    if (start < 0) start = sorted.length;
  }
  const page = sorted.slice(start, start + pageSize);
  const next = sorted[start + pageSize];
  return {
    page,
    nextCursor: next ? encodeNoticeCursor(next.createdAt, next.batchId) : null,
  };
}
