import type { PlatformBoardPostStatus, PlatformBoardType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  markdownWithImagesToHtml,
  maskAuthorName,
  normalizeBoardSlug,
  parseBoardSettings,
  sanitizeBoardBodyHtml,
  type PlatformBoardSettings,
} from './platformBoard.helpers.js';

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
  createdAt: string;
  updatedAt: string;
};

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
    createdAt: Date;
    updatedAt: Date;
    board: { slug: string; label: string; boardType: PlatformBoardType; settings: unknown };
    category: { slug: string; label: string } | null;
    tenant: { name: string } | null;
  },
  opts?: { includeBody?: boolean; maskAuthor?: boolean },
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

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
    const settings = parseBoardSettings(inquiryBoard.settings);
    await prisma.platformBoard.update({
      where: { id: inquiryBoard.id },
      data: {
        settings: {
          ...settings,
          notifyEmail: inquirySettings.notifyEmail,
          contactEmail: inquirySettings.contactEmail,
          composeHelpText: inquirySettings.composeHelpText,
          maskAuthorNames: true,
        },
      },
    });

    const cats = Array.isArray(inquirySettings.categoriesJson)
      ? (inquirySettings.categoriesJson as { id?: string; label?: string; sortOrder?: number }[])
      : [];
    for (const [i, c] of cats.entries()) {
      const slug = normalizeBoardSlug(c.id) ?? `cat-${i}`;
      const label = String(c.label ?? slug).trim().slice(0, 128);
      if (!label) continue;
      await prisma.platformBoardCategory.upsert({
        where: { boardId_slug: { boardId: inquiryBoard.id, slug } },
        create: { boardId: inquiryBoard.id, slug, label, sortOrder: c.sortOrder ?? i },
        update: { label, sortOrder: c.sortOrder ?? i },
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
    await prisma.platformBoardCategory.upsert({
      where: { boardId_slug: { boardId: noticeBoard.id, slug } },
      create: {
        boardId: noticeBoard.id,
        slug,
        label: c.label,
        sortOrder: c.sortOrder,
      },
      update: { label: c.label, sortOrder: c.sortOrder },
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

export async function updatePlatformBoard(
  slug: string,
  input: {
    label?: string;
    isPublished?: boolean;
    listPublic?: boolean;
    settings?: PlatformBoardSettings;
  },
): Promise<PlatformBoardDto> {
  const board = await prisma.platformBoard.findUnique({ where: { slug } });
  if (!board) throw new Error('BOARD_NOT_FOUND');
  const prev = parseBoardSettings(board.settings);
  const row = await prisma.platformBoard.update({
    where: { id: board.id },
    data: {
      label: input.label?.trim().slice(0, 128) || undefined,
      isPublished: input.isPublished,
      listPublic: input.listPublic,
      settings: input.settings ? { ...prev, ...input.settings } : undefined,
    },
    include: { _count: { select: { categories: true, posts: true } } },
  });
  return toBoardDto(row);
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
  const slug = normalizeBoardSlug(input.slug ?? input.label);
  if (!slug) throw new Error('VALIDATION');
  const label = input.label.trim().slice(0, 128);
  if (!label) throw new Error('VALIDATION');
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
    include: postInclude,
  });
  return row ? toPostDto(row) : null;
}

export async function createPlatformBoardPost(input: {
  boardSlug: string;
  categoryId?: string | null;
  title: string;
  excerpt?: string | null;
  bodyHtml: string;
  slug?: string | null;
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
    include: postInclude,
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

  return toPostDto(row, { maskAuthor: board.boardType === 'INQUIRY' });
}

export async function createPublicInquiryPost(input: {
  boardSlug: string;
  categoryId: string;
  authorName: string;
  authorEmail: string;
  title: string;
  bodyHtml: string;
  isSecret?: boolean;
  authorUserId?: string | null;
  tenantId?: string | null;
}): Promise<PlatformBoardPostDto> {
  const board = await prisma.platformBoard.findFirst({
    where: { slug: input.boardSlug, isPublished: true, boardType: 'INQUIRY' },
  });
  if (!board) throw new Error('BOARD_NOT_FOUND');

  const cat = await prisma.platformBoardCategory.findFirst({
    where: { id: input.categoryId, boardId: board.id },
  });
  if (!cat) throw new Error('INVALID_CATEGORY');

  const authorName = input.authorName.trim().slice(0, 64);
  const authorEmail = input.authorEmail.trim().slice(0, 256);
  const title = input.title.trim().slice(0, 256);
  const bodyHtml = sanitizeBoardBodyHtml(input.bodyHtml);
  if (!authorName || !authorEmail.includes('@') || !title || !bodyHtml || bodyHtml === '<p></p>') {
    throw new Error('VALIDATION');
  }

  const row = await prisma.platformBoardPost.create({
    data: {
      boardId: board.id,
      categoryId: cat.id,
      title,
      bodyHtml,
      authorName,
      authorEmail,
      authorUserId: input.authorUserId ?? null,
      tenantId: input.tenantId ?? null,
      isSecret: input.isSecret === true,
      status: 'OPEN',
      isPublished: true,
    },
    include: postInclude,
  });
  return toPostDto(row);
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
