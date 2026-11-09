import { prisma } from '../../lib/prisma.js';
import {
  normalizeHelpCmsSlug,
  parseHelpCmsContentFormat,
  stripDangerousHtml,
} from './helpCms.helpers.js';
import { markdownWithImagesToHtml } from '../platform-board/platformBoard.helpers.js';
import {
  toArticleDto,
  type HelpCmsArticleDto,
} from './helpCms.service.js';

const DEFAULT_CATEGORY_SLUG = 'update';
const DEFAULT_CATEGORY_LABEL = '업데이트';
const NOTICE_TAB = 'notice';
const NOTICE_BOARD_SLUG = 'notice';

const ARTICLE_INCLUDE = {
  category: { select: { slug: true, label: true, tabGroup: true, isPublished: true } },
  author: { select: { name: true } },
} as const;

export async function writeHelpCmsPublishLog(input: {
  actor: string;
  action: string;
  slug?: string | null;
  detail?: string | null;
  requestIp?: string | null;
}): Promise<void> {
  await prisma.helpCmsPublishLog.create({
    data: {
      actor: input.actor.slice(0, 128),
      action: input.action.slice(0, 32),
      slug: input.slug?.slice(0, 128) ?? null,
      detail: input.detail?.slice(0, 4000) ?? null,
      requestIp: input.requestIp?.slice(0, 64) ?? null,
    },
  });
}

/** 공지사항 탭 「업데이트」 카테고리 — 없으면 생성 */
export async function ensureHelpCmsUpdateCategory(categorySlugRaw?: string) {
  const slug =
    normalizeHelpCmsSlug(categorySlugRaw ?? DEFAULT_CATEGORY_SLUG) ?? DEFAULT_CATEGORY_SLUG;
  const existing = await prisma.helpCmsCategory.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.helpCmsCategory.create({
    data: {
      slug,
      label: slug === DEFAULT_CATEGORY_SLUG ? DEFAULT_CATEGORY_LABEL : slug,
      tabGroup: NOTICE_TAB,
      sortOrder: 0,
      isPublished: true,
    },
  });
}

async function mirrorToNoticeBoard(input: {
  categorySlug: string;
  categoryLabel: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMarkdown: string | null;
  bodyHtml: string;
  contentFormat: string;
  isPublished: boolean;
  publishedAt: Date | null;
}): Promise<void> {
  const board = await prisma.platformBoard.findUnique({ where: { slug: NOTICE_BOARD_SLUG } });
  if (!board) return;

  const boardCat = await prisma.platformBoardCategory.upsert({
    where: { boardId_slug: { boardId: board.id, slug: input.categorySlug } },
    create: {
      boardId: board.id,
      slug: input.categorySlug,
      label: input.categoryLabel,
      sortOrder: 0,
    },
    update: { label: input.categoryLabel },
  });

  const bodyHtml =
    input.contentFormat === 'markdown' && input.bodyMarkdown
      ? markdownWithImagesToHtml(input.bodyMarkdown, [])
      : stripDangerousHtml(input.bodyHtml) || '<p></p>';

  const existing = await prisma.platformBoardPost.findUnique({
    where: { legacyHelpCmsSlug: input.slug },
  });

  if (existing) {
    await prisma.platformBoardPost.update({
      where: { id: existing.id },
      data: {
        categoryId: boardCat.id,
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt,
        bodyHtml,
        isPublished: input.isPublished,
        publishedAt: input.isPublished
          ? existing.publishedAt ?? input.publishedAt ?? new Date()
          : null,
      },
    });
    return;
  }

  await prisma.platformBoardPost.create({
    data: {
      boardId: board.id,
      categoryId: boardCat.id,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      bodyHtml,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? input.publishedAt ?? new Date() : null,
      legacyHelpCmsSlug: input.slug,
    },
  });
}

export async function upsertHelpCmsPublishArticle(input: {
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  bodyMarkdown: string;
  categorySlug?: string;
  isPublished?: boolean;
}): Promise<{ item: HelpCmsArticleDto; created: boolean }> {
  const slug = normalizeHelpCmsSlug(input.slug);
  if (!slug) throw new Error('INVALID_SLUG');
  const title = String(input.title ?? '').trim();
  if (!title) throw new Error('TITLE_REQUIRED');
  const bodyMarkdown = String(input.bodyMarkdown ?? '').trim();
  if (!bodyMarkdown) throw new Error('CONTENT_REQUIRED');

  const category = await ensureHelpCmsUpdateCategory(input.categorySlug);
  const isPublished = input.isPublished ?? false;
  const contentFormat = parseHelpCmsContentFormat('markdown');

  const existing = await prisma.helpCmsArticle.findUnique({ where: { slug } });

  let row;
  let created: boolean;
  if (existing) {
    created = false;
    let publishedAt: Date | null | undefined;
    if (isPublished && !existing.isPublished) publishedAt = new Date();
    if (!isPublished) publishedAt = null;
    row = await prisma.helpCmsArticle.update({
      where: { id: existing.id },
      data: {
        categoryId: category.id,
        title,
        excerpt: input.excerpt?.trim().slice(0, 500) || null,
        coverImageUrl: input.coverImageUrl?.trim() || null,
        bodyMarkdown,
        bodyHtml: '<p></p>',
        contentFormat,
        isPublished,
        ...(publishedAt !== undefined ? { publishedAt } : {}),
      },
      include: ARTICLE_INCLUDE,
    });
  } else {
    created = true;
    const maxOrder = await prisma.helpCmsArticle.aggregate({
      where: { categoryId: category.id },
      _max: { sortOrder: true },
    });
    row = await prisma.helpCmsArticle.create({
      data: {
        categoryId: category.id,
        slug,
        title,
        excerpt: input.excerpt?.trim().slice(0, 500) || null,
        coverImageUrl: input.coverImageUrl?.trim() || null,
        bodyMarkdown,
        bodyHtml: '<p></p>',
        contentFormat,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        authorPlatformUserId: null,
      },
      include: ARTICLE_INCLUDE,
    });
  }

  await mirrorToNoticeBoard({
    categorySlug: category.slug,
    categoryLabel: category.label,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMarkdown: row.bodyMarkdown,
    bodyHtml: row.bodyHtml,
    contentFormat: row.contentFormat,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt,
  });

  return { item: toArticleDto(row), created };
}
