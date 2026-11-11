import { Prisma, type PlatformBoardPostStatus, type PlatformBoardType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  markdownWithImagesToHtml,
  maskAuthorName,
  normalizeBoardSlug,
  parseBoardSettings,
  sanitizeBoardBodyHtml,
  slugFromCategoryLabel,
  parseReplyInboxStored,
  type PlatformBoardSettings,
} from './platformBoard.helpers.js';
import {
  INQUIRY_PRIVACY_CONSENT_VERSION,
  MAX_NOTIFY_EMAILS,
  defaultImapHostForEmail,
  generateReplyToken,
  htmlToPlainText,
  isValidEmail,
  parseNotifyEmails,
  validateInquiryInput,
} from './platformBoardInquiry.helpers.js';
import { encryptTenantSecret } from '../../lib/tenantSecretCrypto.js';

let legacyMigrationPromise: Promise<void> | null = null;

export type PlatformBoardDto = {
  id: string;
  slug: string;
  label: string;
  boardType: PlatformBoardType;
  sortOrder: number;
  isPublished: boolean;
  listPublic: boolean;
  settings: PlatformBoardSettings;
  categoryCount: number;
  postCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformBoardCategoryDto = {
  id: string;
  boardId: string;
  slug: string;
  label: string;
  sortOrder: number;
  postCount: number;
};

export type PlatformBoardPostDto = {
  id: string;
  boardId: string;
  boardSlug: string;
  boardLabel: string;
  boardType: PlatformBoardType;
  categoryId: string | null;
  categorySlug: string | null;
  categoryLabel: string | null;
  slug: string | null;
  title: string;
  excerpt: string | null;
  bodyHtml: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorUserId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  isSecret: boolean;
  status: PlatformBoardPostStatus;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  viewCount: number;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** 플랫폼 관리자 화면에서만 채운다(공개 응답에는 없음) */
  authorPhone?: string | null;
  replyToken?: string | null;
  privacyConsentAt?: string | null;
  /** 답변·추가 질문 — 글 상세에서만 */
  replies?: PlatformBoardReplyDto[];
};

export type PlatformBoardReplyDto = {
  id: string;
  authorType: 'ADMIN' | 'CUSTOMER';
  source: 'PLATFORM' | 'EMAIL';
  bodyHtml: string;
  createdAt: string;
  /** 아래 셋은 플랫폼 관리자 화면에서만 */
  fromEmail?: string | null;
  emailSentAt?: string | null;
  emailError?: string | null;
};

type ReplyRow = {
  id: string;
  authorType: 'ADMIN' | 'CUSTOMER';
  source: 'PLATFORM' | 'EMAIL';
  bodyHtml: string;
  createdAt: Date;
  fromEmail: string | null;
  emailSentAt: Date | null;
  emailError: string | null;
};

export function toReplyDto(row: ReplyRow, opts?: { includeContact?: boolean }): PlatformBoardReplyDto {
  const base: PlatformBoardReplyDto = {
    id: row.id,
    authorType: row.authorType,
    source: row.source,
    bodyHtml: row.bodyHtml,
    createdAt: row.createdAt.toISOString(),
  };
  if (!opts?.includeContact) return base;
  return {
    ...base,
    fromEmail: row.fromEmail,
    emailSentAt: row.emailSentAt?.toISOString() ?? null,
    emailError: row.emailError,
  };
}

function toBoardDto(row: {
  id: string;
  slug: string;
  label: string;
  boardType: PlatformBoardType;
  sortOrder: number;
  isPublished: boolean;
  listPublic: boolean;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count?: { categories: number; posts: number };
}): PlatformBoardDto {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    boardType: row.boardType,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    listPublic: row.listPublic,
    settings: parseBoardSettings(row.settings),
    categoryCount: row._count?.categories ?? 0,
    postCount: row._count?.posts ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCategoryDto(row: {
  id: string;
  boardId: string;
  slug: string;
  label: string;
  sortOrder: number;
  _count?: { posts: number };
}): PlatformBoardCategoryDto {
  return {
    id: row.id,
    boardId: row.boardId,
    slug: row.slug,
    label: row.label,
    sortOrder: row.sortOrder,
    postCount: row._count?.posts ?? 0,
  };
}

function toPostDto(
  row: {
    id: string;
    boardId: string;
    categoryId: string | null;
    slug: string | null;
    title: string;
    excerpt: string | null;
    bodyHtml: string;
    authorName: string | null;
    authorEmail: string | null;
    authorUserId: string | null;
    tenantId: string | null;
    isSecret: boolean;
    status: PlatformBoardPostStatus;
    isPinned: boolean;
    isPublished: boolean;
    publishedAt: Date | null;
    viewCount: number;
    thumbnailUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
    board: { slug: string; label: string; boardType: PlatformBoardType; settings: unknown };
    category: { slug: string; label: string } | null;
    tenant: { name: string } | null;
    authorPhone?: string | null;
    replyToken?: string | null;
    privacyConsentAt?: Date | null;
    replies?: ReplyRow[];
  },
  opts?: { includeBody?: boolean; maskAuthor?: boolean; includeContact?: boolean; includeReplies?: boolean },
): PlatformBoardPostDto {
  const includeBody = opts?.includeBody !== false;
  const maskAuthor = opts?.maskAuthor === true;
  const settings = parseBoardSettings(row.board.settings);
  const shouldMask = maskAuthor && settings.maskAuthorNames !== false;

  return {
    id: row.id,
    boardId: row.boardId,
    boardSlug: row.board.slug,
    boardLabel: row.board.label,
    boardType: row.board.boardType,
    categoryId: row.categoryId,
    categorySlug: row.category?.slug ?? null,
    categoryLabel: row.category?.label ?? null,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyHtml: includeBody ? row.bodyHtml : null,
    authorName: shouldMask ? maskAuthorName(row.authorName) : row.authorName,
    authorEmail: shouldMask ? null : row.authorEmail,
    authorUserId: row.authorUserId,
    tenantId: row.tenantId,
    tenantName: row.tenant?.name ?? null,
    isSecret: row.isSecret,
    status: row.status,
    isPinned: row.isPinned,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    viewCount: row.viewCount,
    thumbnailUrl: row.thumbnailUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(opts?.includeContact
      ? {
          authorPhone: row.authorPhone ?? null,
          replyToken: row.replyToken ?? null,
          privacyConsentAt: row.privacyConsentAt?.toISOString() ?? null,
        }
      : {}),
    ...(opts?.includeReplies && row.replies
      ? { replies: row.replies.map((r) => toReplyDto(r, { includeContact: opts?.includeContact })) }
      : {}),
  };
}

const replySelect = {
  id: true,
  authorType: true,
  source: true,
  bodyHtml: true,
  createdAt: true,
  fromEmail: true,
  emailSentAt: true,
  emailError: true,
} as const;

const postInclude = {
  board: { select: { slug: true, label: true, boardType: true, settings: true } },
  category: { select: { slug: true, label: true } },
  tenant: { select: { name: true } },
} as const;

export async function ensurePlatformBoardLegacyMigrated(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = runLegacyMigration().catch((e) => {
      legacyMigrationPromise = null;
      throw e;
    });
  }
  await legacyMigrationPromise;
}

async function runLegacyMigration(): Promise<void> {
  const inquiryBoard = await prisma.platformBoard.findUnique({ where: { slug: 'inquiry' } });
  const noticeBoard = await prisma.platformBoard.findUnique({ where: { slug: 'notice' } });
  if (!inquiryBoard || !noticeBoard) return;

  const inquirySettings = await prisma.helpInquirySettings.findUnique({ where: { id: 'default' } });
  if (inquirySettings) {
    // 예전 문의 설정은 비어 있는 칸만 채운다 — 플랫폼에서 저장한 값(알림 메일·답장 메일함)을 덮어쓰지 않는다
    const raw = rawSettingsObject(inquiryBoard.settings);
    const next: Record<string, unknown> = { ...raw };
    let changed = false;
    if (raw.notifyEmail === undefined && raw.notifyEmails === undefined && inquirySettings.notifyEmail) {
      next.notifyEmail = inquirySettings.notifyEmail;
      changed = true;
    }
    if (raw.contactEmail === undefined && inquirySettings.contactEmail) {
      next.contactEmail = inquirySettings.contactEmail;
      changed = true;
    }
    if (raw.composeHelpText === undefined && inquirySettings.composeHelpText) {
      next.composeHelpText = inquirySettings.composeHelpText;
      changed = true;
    }
    if (raw.maskAuthorNames === undefined) {
      next.maskAuthorNames = true;
      changed = true;
    }
    if (changed) {
      await prisma.platformBoard.update({
        where: { id: inquiryBoard.id },
        data: { settings: next as Prisma.InputJsonValue },
      });
    }

    const cats = Array.isArray(inquirySettings.categoriesJson)
      ? (inquirySettings.categoriesJson as { id?: string; label?: string; sortOrder?: number }[])
      : [];
    for (const [i, c] of cats.entries()) {
      const slug = normalizeBoardSlug(c.id) ?? `cat-${i}`;
      const label = String(c.label ?? slug).trim().slice(0, 128);
      if (!label) continue;
      // 이미 있으면 label·sortOrder를 덮어쓰지 않음 (플랫폼에서 바꾼 이름 유지)
      await prisma.platformBoardCategory.upsert({
        where: { boardId_slug: { boardId: inquiryBoard.id, slug } },
        create: { boardId: inquiryBoard.id, slug, label, sortOrder: c.sortOrder ?? i },
        update: {},
      });
    }
  }

  const inquiryPosts = await prisma.helpInquiryPost.findMany();
  for (const p of inquiryPosts) {
    const existing = await prisma.platformBoardPost.findUnique({
      where: { legacyHelpInquiryId: p.id },
    });
    if (existing) continue;
    const catSlug = normalizeBoardSlug(p.categoryId) ?? p.categoryId;
    const category = await prisma.platformBoardCategory.findUnique({
      where: { boardId_slug: { boardId: inquiryBoard.id, slug: catSlug } },
    });
    const imageUrls = Array.isArray(p.imageUrls)
      ? p.imageUrls.filter((u): u is string => typeof u === 'string')
      : [];
    await prisma.platformBoardPost.create({
      data: {
        boardId: inquiryBoard.id,
        categoryId: category?.id ?? null,
        title: p.title,
        bodyHtml: markdownWithImagesToHtml(p.bodyMarkdown, imageUrls),
        authorName: p.authorName,
        authorEmail: p.authorEmail,
        isSecret: false,
        status: 'OPEN',
        isPublished: true,
        legacyHelpInquiryId: p.id,
        createdAt: p.createdAt,
      },
    });
  }

  const noticeCategories = await prisma.helpCmsCategory.findMany({
    where: { tabGroup: 'notice' },
    orderBy: { sortOrder: 'asc' },
  });
  for (const c of noticeCategories) {
    const slug = normalizeBoardSlug(c.slug) ?? c.slug;
    // 이미 있으면 label·sortOrder를 덮어쓰지 않음
    await prisma.platformBoardCategory.upsert({
      where: { boardId_slug: { boardId: noticeBoard.id, slug } },
      create: {
        boardId: noticeBoard.id,
        slug,
        label: c.label,
        sortOrder: c.sortOrder,
      },
      update: {},
    });
  }

  const noticeArticles = await prisma.helpCmsArticle.findMany({
    where: { category: { tabGroup: 'notice' } },
    include: { category: true },
  });
  for (const a of noticeArticles) {
    const existing = await prisma.platformBoardPost.findUnique({
      where: { legacyHelpCmsSlug: a.slug },
    });
    if (existing) continue;
    const catSlug = normalizeBoardSlug(a.category.slug) ?? a.category.slug;
    const category = await prisma.platformBoardCategory.findUnique({
      where: { boardId_slug: { boardId: noticeBoard.id, slug: catSlug } },
    });
    await prisma.platformBoardPost.create({
      data: {
        boardId: noticeBoard.id,
        categoryId: category?.id ?? null,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        bodyHtml: a.bodyHtml,
        isPinned: false,
        isPublished: a.isPublished,
        publishedAt: a.publishedAt,
        authorPlatformUserId: a.authorPlatformUserId,
        legacyHelpCmsSlug: a.slug,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      },
    });
  }
}

export async function listPlatformBoards(): Promise<PlatformBoardDto[]> {
  await ensurePlatformBoardLegacyMigrated();
  const rows = await prisma.platformBoard.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    include: { _count: { select: { categories: true, posts: true } } },
  });
  return rows.map(toBoardDto);
}

export async function getPlatformBoardBySlug(slug: string): Promise<PlatformBoardDto | null> {
  await ensurePlatformBoardLegacyMigrated();
  const row = await prisma.platformBoard.findUnique({
    where: { slug },
    include: { _count: { select: { categories: true, posts: true } } },
  });
  return row ? toBoardDto(row) : null;
}

export type PlatformBoardSettingsPatch = {
  notifyEmail?: string;
  notifyEmails?: string[];
  contactEmail?: string;
  composeHelpText?: string | null;
  maskAuthorNames?: boolean;
  /** null 이면 답장 메일함 연결 해제. password 를 비우면 저장된 비밀번호 유지 */
  replyInbox?: { email?: string; host?: string; port?: number; password?: string } | null;
};

export function rawSettingsObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

/** 설정 patch → 저장할 settings JSON (암호화·검사 포함) */
export function applyBoardSettingsPatch(
  current: unknown,
  patch: PlatformBoardSettingsPatch,
): Record<string, unknown> {
  const next = rawSettingsObject(current);
  if (patch.notifyEmails !== undefined) {
    const input = Array.isArray(patch.notifyEmails) ? patch.notifyEmails : [];
    const trimmed = input.map((e) => String(e ?? '').trim()).filter(Boolean);
    if (trimmed.length > MAX_NOTIFY_EMAILS) throw new Error('TOO_MANY_NOTIFY_EMAILS');
    if (trimmed.some((e) => !isValidEmail(e))) throw new Error('INVALID_NOTIFY_EMAIL');
    const list = parseNotifyEmails({ notifyEmails: trimmed });
    next.notifyEmails = list;
    next.notifyEmail = list[0] ?? '';
  } else if (patch.notifyEmail !== undefined) {
    const one = String(patch.notifyEmail ?? '').trim();
    if (one && !isValidEmail(one)) throw new Error('INVALID_NOTIFY_EMAIL');
    next.notifyEmail = one;
    next.notifyEmails = one ? [one] : [];
  }
  if (patch.contactEmail !== undefined) next.contactEmail = String(patch.contactEmail ?? '').trim();
  if (patch.composeHelpText !== undefined) next.composeHelpText = patch.composeHelpText;
  if (patch.maskAuthorNames !== undefined) next.maskAuthorNames = patch.maskAuthorNames;
  if (patch.replyInbox === null) {
    delete next.replyInbox;
  } else if (patch.replyInbox) {
    const prev = parseReplyInboxStored(current);
    const email = String(patch.replyInbox.email ?? '').trim();
    if (!isValidEmail(email)) throw new Error('INVALID_INBOX_EMAIL');
    const host =
      String(patch.replyInbox.host ?? '').trim() || defaultImapHostForEmail(email) || '';
    if (!host || !/^[a-z0-9.-]+$/i.test(host)) throw new Error('INVALID_INBOX_HOST');
    const portNum = Number(patch.replyInbox.port ?? 993);
    const port = Number.isInteger(portNum) && portNum > 0 && portNum < 65536 ? portNum : 993;
    const password = String(patch.replyInbox.password ?? '');
    const sameBox = prev && prev.email.toLowerCase() === email.toLowerCase();
    const passEnc = password ? encryptTenantSecret(password) : sameBox ? prev?.passEnc : undefined;
    next.replyInbox = {
      email,
      host,
      port,
      ...(passEnc ? { passEnc } : {}),
      lastSyncAt: sameBox ? prev?.lastSyncAt ?? null : null,
      lastError: null,
    };
  }
  return next;
}

export async function updatePlatformBoard(
  slug: string,
  input: {
    label?: string;
    isPublished?: boolean;
    listPublic?: boolean;
    settings?: PlatformBoardSettingsPatch;
  },
): Promise<PlatformBoardDto> {
  const board = await prisma.platformBoard.findUnique({ where: { slug } });
  if (!board) throw new Error('BOARD_NOT_FOUND');
  const settings = input.settings ? applyBoardSettingsPatch(board.settings, input.settings) : undefined;
  const row = await prisma.platformBoard.update({
    where: { id: board.id },
    data: {
      label: input.label?.trim().slice(0, 128) || undefined,
      isPublished: input.isPublished,
      listPublic: input.listPublic,
      settings: settings ? (settings as Prisma.InputJsonValue) : undefined,
    },
    include: { _count: { select: { categories: true, posts: true } } },
  });
  return toBoardDto(row);
}

/** 답장 메일함 마지막 확인 시각·오류만 바꾼다(다른 설정은 그대로) */
export async function setReplyInboxStatus(
  boardId: string,
  status: { lastSyncAt: Date; lastError: string | null },
): Promise<void> {
  const board = await prisma.platformBoard.findUnique({ where: { id: boardId }, select: { settings: true } });
  if (!board) return;
  const raw = rawSettingsObject(board.settings);
  const box = raw.replyInbox;
  if (!box || typeof box !== 'object') return;
  raw.replyInbox = {
    ...(box as Record<string, unknown>),
    lastSyncAt: status.lastSyncAt.toISOString(),
    lastError: status.lastError ? status.lastError.slice(0, 300) : null,
  };
  await prisma.platformBoard.update({ where: { id: boardId }, data: { settings: raw as Prisma.InputJsonValue } });
}

export async function listPlatformBoardCategories(boardSlug: string): Promise<PlatformBoardCategoryDto[]> {
  const board = await getPlatformBoardBySlug(boardSlug);
  if (!board) throw new Error('BOARD_NOT_FOUND');
  const rows = await prisma.platformBoardCategory.findMany({
    where: { boardId: board.id },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    include: { _count: { select: { posts: true } } },
  });
  return rows.map(toCategoryDto);
}

export async function createPlatformBoardCategory(
  boardSlug: string,
  input: { slug?: string; label: string; sortOrder?: number },
): Promise<PlatformBoardCategoryDto> {
  const board = await prisma.platformBoard.findUnique({ where: { slug: boardSlug } });
  if (!board) throw new Error('BOARD_NOT_FOUND');
  const label = input.label.trim().slice(0, 128);
  if (!label) throw new Error('VALIDATION');
  let slug = normalizeBoardSlug(input.slug) ?? slugFromCategoryLabel(label);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const row = await prisma.platformBoardCategory.create({
        data: {
          boardId: board.id,
          slug,
          label,
          sortOrder: input.sortOrder ?? 0,
        },
        include: { _count: { select: { posts: true } } },
      });
      return toCategoryDto(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        slug = `${slugFromCategoryLabel(label)}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      throw e;
    }
  }
  throw new Error('DUPLICATE_CATEGORY');
}

export async function updatePlatformBoardCategory(
  boardSlug: string,
  categoryId: string,
  input: { label?: string; sortOrder?: number },
): Promise<PlatformBoardCategoryDto> {
  const board = await prisma.platformBoard.findUnique({ where: { slug: boardSlug } });
  if (!board) throw new Error('BOARD_NOT_FOUND');
  const row = await prisma.platformBoardCategory.update({
    where: { id: categoryId, boardId: board.id },
    data: {
      label: input.label?.trim().slice(0, 128) || undefined,
      sortOrder: input.sortOrder,
    },
    include: { _count: { select: { posts: true } } },
  });
  return toCategoryDto(row);
}

export async function deletePlatformBoardCategory(boardSlug: string, categoryId: string): Promise<void> {
  const board = await prisma.platformBoard.findUnique({ where: { slug: boardSlug } });
  if (!board) throw new Error('BOARD_NOT_FOUND');
  await prisma.platformBoardCategory.delete({ where: { id: categoryId, boardId: board.id } });
}

export async function listPlatformBoardPosts(params: {
  boardSlug?: string;
  categoryId?: string;
  status?: PlatformBoardPostStatus;
  q?: string;
  limit: number;
  offset: number;
}): Promise<{ items: PlatformBoardPostDto[]; total: number }> {
  await ensurePlatformBoardLegacyMigrated();
  const where: {
    board?: { slug: string };
    categoryId?: string;
    status?: PlatformBoardPostStatus;
    OR?: { title?: { contains: string; mode: 'insensitive' }; excerpt?: { contains: string; mode: 'insensitive' } }[];
  } = {};
  if (params.boardSlug) where.board = { slug: params.boardSlug };
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.status) where.status = params.status;
  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { excerpt: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.platformBoardPost.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: params.limit,
      skip: params.offset,
      include: postInclude,
    }),
    prisma.platformBoardPost.count({ where }),
  ]);
  return {
    items: rows.map((r) => toPostDto(r, { includeBody: false, maskAuthor: false })),
    total,
  };
}

export async function getPlatformBoardPost(id: string): Promise<PlatformBoardPostDto | null> {
  const row = await prisma.platformBoardPost.findUnique({
    where: { id },
    include: { ...postInclude, replies: { select: replySelect, orderBy: { createdAt: 'asc' } } },
  });
  return row ? toPostDto(row, { includeContact: true, includeReplies: true }) : null;
}

export async function createPlatformBoardPost(input: {
  boardSlug: string;
  categoryId?: string | null;
  title: string;
  excerpt?: string | null;
  bodyHtml: string;
  slug?: string | null;
  thumbnailUrl?: string | null;
  isPinned?: boolean;
  isPublished?: boolean;
  authorPlatformUserId?: string | null;
}): Promise<PlatformBoardPostDto> {
  const board = await prisma.platformBoard.findUnique({ where: { slug: input.boardSlug } });
  if (!board) throw new Error('BOARD_NOT_FOUND');
  if (input.categoryId) {
    const cat = await prisma.platformBoardCategory.findFirst({
      where: { id: input.categoryId, boardId: board.id },
    });
    if (!cat) throw new Error('INVALID_CATEGORY');
  }
  const bodyHtml = sanitizeBoardBodyHtml(input.bodyHtml);
  if (!bodyHtml || bodyHtml === '<p></p>') throw new Error('CONTENT_REQUIRED');
  const title = input.title.trim().slice(0, 256);
  if (!title) throw new Error('VALIDATION');

  const row = await prisma.platformBoardPost.create({
    data: {
      boardId: board.id,
      categoryId: input.categoryId ?? null,
      slug: input.slug?.trim().slice(0, 128) || null,
      title,
      excerpt: input.excerpt?.trim().slice(0, 500) || null,
      bodyHtml,
      thumbnailUrl: input.thumbnailUrl?.trim().slice(0, 512) || null,
      isPinned: input.isPinned ?? false,
      isPublished: input.isPublished ?? true,
      publishedAt: input.isPublished !== false ? new Date() : null,
      authorPlatformUserId: input.authorPlatformUserId ?? null,
    },
    include: postInclude,
  });
  return toPostDto(row);
}

export async function updatePlatformBoardPost(
  id: string,
  input: {
    categoryId?: string | null;
    title?: string;
    excerpt?: string | null;
    bodyHtml?: string;
    slug?: string | null;
    thumbnailUrl?: string | null;
    isPinned?: boolean;
    isPublished?: boolean;
    status?: PlatformBoardPostStatus;
    isSecret?: boolean;
  },
): Promise<PlatformBoardPostDto> {
  const existing = await prisma.platformBoardPost.findUnique({ where: { id }, include: { board: true } });
  if (!existing) throw new Error('NOT_FOUND');
  if (input.categoryId) {
    const cat = await prisma.platformBoardCategory.findFirst({
      where: { id: input.categoryId, boardId: existing.boardId },
    });
    if (!cat) throw new Error('INVALID_CATEGORY');
  }
  let bodyHtml: string | undefined;
  if (input.bodyHtml !== undefined) {
    bodyHtml = sanitizeBoardBodyHtml(input.bodyHtml);
    if (!bodyHtml || bodyHtml === '<p></p>') throw new Error('CONTENT_REQUIRED');
  }

  const row = await prisma.platformBoardPost.update({
    where: { id },
    data: {
      categoryId: input.categoryId,
      title: input.title?.trim().slice(0, 256),
      excerpt: input.excerpt !== undefined ? input.excerpt?.trim().slice(0, 500) || null : undefined,
      bodyHtml,
      slug: input.slug !== undefined ? input.slug?.trim().slice(0, 128) || null : undefined,
      thumbnailUrl:
        input.thumbnailUrl !== undefined
          ? input.thumbnailUrl?.trim().slice(0, 512) || null
          : undefined,
      isPinned: input.isPinned,
      isPublished: input.isPublished,
      status: input.status,
      isSecret: input.isSecret,
      publishedAt:
        input.isPublished === true && !existing.publishedAt ? new Date() : undefined,
    },
    include: postInclude,
  });
  return toPostDto(row);
}

export async function deletePlatformBoardPost(id: string): Promise<void> {
  await prisma.platformBoardPost.delete({ where: { id } });
}

export async function listPublicBoardPosts(params: {
  boardSlug: string;
  categorySlug?: string;
  q?: string;
  limit: number;
  offset: number;
}): Promise<{ items: PlatformBoardPostDto[]; total: number }> {
  await ensurePlatformBoardLegacyMigrated();
  const board = await prisma.platformBoard.findFirst({
    where: { slug: params.boardSlug, isPublished: true },
  });
  if (!board) throw new Error('BOARD_NOT_FOUND');

  const where: {
    boardId: string;
    isPublished: boolean;
    status?: { not: 'HIDDEN' };
    category?: { slug: string };
    OR?: { title?: { contains: string; mode: 'insensitive' }; excerpt?: { contains: string; mode: 'insensitive' } }[];
  } = {
    boardId: board.id,
    isPublished: true,
    status: { not: 'HIDDEN' },
  };
  if (params.categorySlug) where.category = { slug: params.categorySlug };
  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { excerpt: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.platformBoardPost.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: params.limit,
      skip: params.offset,
      include: postInclude,
    }),
    prisma.platformBoardPost.count({ where }),
  ]);

  const maskAuthor = board.boardType === 'INQUIRY';
  return {
    items: rows.map((r) =>
      toPostDto(r, {
        includeBody: false,
        maskAuthor,
      }),
    ),
    total,
  };
}

export async function getPublicBoardPost(params: {
  boardSlug: string;
  postId: string;
  accessEmail?: string;
  accessUserId?: string;
}): Promise<PlatformBoardPostDto> {
  const board = await prisma.platformBoard.findFirst({
    where: { slug: params.boardSlug, isPublished: true },
  });
  if (!board) throw new Error('BOARD_NOT_FOUND');

  const row = await prisma.platformBoardPost.findFirst({
    where: {
      id: params.postId,
      boardId: board.id,
      isPublished: true,
      status: { not: 'HIDDEN' },
    },
    include: { ...postInclude, replies: { select: replySelect, orderBy: { createdAt: 'asc' } } },
  });
  if (!row) throw new Error('NOT_FOUND');

  if (row.isSecret) {
    const email = params.accessEmail?.trim().toLowerCase();
    const authorEmail = row.authorEmail?.trim().toLowerCase();
    const userMatch = params.accessUserId && row.authorUserId === params.accessUserId;
    const emailMatch = email && authorEmail && email === authorEmail;
    if (!userMatch && !emailMatch) {
      return toPostDto(row, {
        includeBody: false,
        maskAuthor: board.boardType === 'INQUIRY',
      });
    }
  }

  await prisma.platformBoardPost.update({
    where: { id: row.id },
    data: { viewCount: { increment: 1 } },
  });

  return toPostDto(row, { maskAuthor: board.boardType === 'INQUIRY', includeReplies: true });
}

export async function createPublicInquiryPost(input: {
  boardSlug: string;
  categoryId: string;
  authorName: string;
  authorEmail: string;
  authorPhone: string;
  privacyConsent: unknown;
  consentVersion: unknown;
  title: string;
  bodyHtml: string;
  isSecret?: boolean;
  authorUserId?: string | null;
  tenantId?: string | null;
}): Promise<PlatformBoardPostDto> {
  const bodyHtml = sanitizeBoardBodyHtml(input.bodyHtml);
  const bodyText = htmlToPlainText(bodyHtml) || (/<img\b/i.test(bodyHtml) ? '사진' : '');
  const valid = validateInquiryInput({
    categoryId: input.categoryId,
    authorName: input.authorName,
    authorPhone: input.authorPhone,
    authorEmail: input.authorEmail,
    title: input.title,
    bodyText,
    privacyConsent: input.privacyConsent,
    consentVersion: input.consentVersion,
  });

  const board = await prisma.platformBoard.findFirst({
    where: { slug: input.boardSlug, isPublished: true, boardType: 'INQUIRY' },
  });
  if (!board) throw new Error('BOARD_NOT_FOUND');

  const cat = await prisma.platformBoardCategory.findFirst({
    where: { id: input.categoryId, boardId: board.id },
  });
  if (!cat) throw new Error('INVALID_CATEGORY');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const row = await prisma.platformBoardPost.create({
        data: {
          boardId: board.id,
          categoryId: cat.id,
          title: valid.title,
          bodyHtml,
          authorName: valid.authorName,
          authorEmail: valid.authorEmail,
          authorPhone: valid.authorPhone,
          privacyConsentAt: new Date(),
          privacyConsentVersion: INQUIRY_PRIVACY_CONSENT_VERSION,
          replyToken: generateReplyToken(),
          authorUserId: input.authorUserId ?? null,
          tenantId: input.tenantId ?? null,
          isSecret: input.isSecret === true,
          status: 'OPEN',
          isPublished: true,
        },
        include: postInclude,
      });
      return toPostDto(row, { includeContact: true });
    } catch (e) {
      const dup =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        String((e.meta as { target?: unknown } | undefined)?.target ?? '').includes('reply_token');
      if (!dup) throw e;
    }
  }
  throw new Error('REPLY_TOKEN_EXHAUSTED');
}

export type PlatformBoardSeoPost = {
  id: string;
  title: string;
  excerpt: string | null;
  bodyHtml: string;
  publishedAt: Date | null;
  updatedAt: Date;
};

const NOTICE_BOARD_SLUG = 'notice';

/** 검색 노출용 공개 공지 — 비밀글·숨김·조회수 증가 없음 */
export async function listIndexableNoticePostsForSeo(limit = 200): Promise<PlatformBoardSeoPost[]> {
  const board = await prisma.platformBoard.findFirst({
    where: { slug: NOTICE_BOARD_SLUG, isPublished: true },
  });
  if (!board) return [];
  const take = Math.min(5000, Math.max(1, limit));
  return prisma.platformBoardPost.findMany({
    where: {
      boardId: board.id,
      isPublished: true,
      isSecret: false,
      status: { not: 'HIDDEN' },
    },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    take,
    select: {
      id: true,
      title: true,
      excerpt: true,
      bodyHtml: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

export async function getIndexableNoticePostForSeo(postId: string): Promise<PlatformBoardSeoPost | null> {
  const id = postId.trim();
  if (!id) return null;
  const board = await prisma.platformBoard.findFirst({
    where: { slug: NOTICE_BOARD_SLUG, isPublished: true },
  });
  if (!board) return null;
  return prisma.platformBoardPost.findFirst({
    where: {
      id,
      boardId: board.id,
      isPublished: true,
      isSecret: false,
      status: { not: 'HIDDEN' },
    },
    select: {
      id: true,
      title: true,
      excerpt: true,
      bodyHtml: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

export async function getPublicBoardSettings(boardSlug: string): Promise<{
  slug: string;
  label: string;
  boardType: PlatformBoardType;
  listPublic: boolean;
  settings: PlatformBoardSettings;
  categories: PlatformBoardCategoryDto[];
}> {
  const board = await getPlatformBoardBySlug(boardSlug);
  if (!board || !board.isPublished) throw new Error('BOARD_NOT_FOUND');
  const categories = await listPlatformBoardCategories(boardSlug);
  return {
    slug: board.slug,
    label: board.label,
    boardType: board.boardType,
    listPublic: board.listPublic,
    settings: board.settings,
    categories,
  };
}
