import type { PlatformRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  normalizeHelpCmsSlug,
  parseHelpCmsContentFormat,
  parseHelpCmsTabGroup,
  slugFromTitle,
  stripDangerousHtml,
  type HelpCmsContentFormat,
} from './helpCms.helpers.js';

export type HelpCmsCategoryDto = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  tabGroup: string;
  sortOrder: number;
  isPublished: boolean;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type HelpCmsArticleDto = {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryLabel: string;
  tabGroup: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  bodyHtml: string;
  bodyMarkdown: string | null;
  contentFormat: HelpCmsContentFormat;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  authorPlatformUserId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HelpCmsArticleListItem = Omit<HelpCmsArticleDto, 'bodyHtml' | 'bodyMarkdown'>;

function toCategoryDto(row: {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  tabGroup: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { articles: number };
}): HelpCmsCategoryDto {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    tabGroup: row.tabGroup,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    articleCount: row._count?.articles ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeArticleBody(input: {
  contentFormat?: unknown;
  bodyHtml?: string;
  bodyMarkdown?: string | null;
}): { contentFormat: HelpCmsContentFormat; bodyHtml: string; bodyMarkdown: string | null } {
  const contentFormat = parseHelpCmsContentFormat(input.contentFormat);
  if (contentFormat === 'markdown') {
    const bodyMarkdown = String(input.bodyMarkdown ?? '').trim();
    if (!bodyMarkdown) throw new Error('CONTENT_REQUIRED');
    return { contentFormat, bodyMarkdown, bodyHtml: '<p></p>' };
  }
  const bodyHtml = stripDangerousHtml(String(input.bodyHtml ?? '').trim());
  if (!bodyHtml || bodyHtml === '<p></p>') throw new Error('CONTENT_REQUIRED');
  return { contentFormat: 'html', bodyHtml, bodyMarkdown: null };
}

function toArticleDto(row: {
  id: string;
  categoryId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  bodyHtml: string;
  bodyMarkdown: string | null;
  contentFormat: string;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: Date | null;
  authorPlatformUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { slug: string; label: string; tabGroup: string };
  author: { name: string } | null;
}): HelpCmsArticleDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categorySlug: row.category.slug,
    categoryLabel: row.category.label,
    tabGroup: row.category.tabGroup,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.coverImageUrl,
    bodyHtml: row.bodyHtml,
    bodyMarkdown: row.bodyMarkdown,
    contentFormat: parseHelpCmsContentFormat(row.contentFormat),
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    authorPlatformUserId: row.authorPlatformUserId,
    authorName: row.author?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toListItem(row: HelpCmsArticleDto): HelpCmsArticleListItem {
  const { bodyHtml: _b, bodyMarkdown: _m, ...rest } = row;
  return rest;
}

const ARTICLE_INCLUDE = {
  category: { select: { slug: true, label: true, tabGroup: true, isPublished: true } },
  author: { select: { name: true } },
} as const;

export async function listHelpCmsCategoriesPlatform(): Promise<HelpCmsCategoryDto[]> {
  const rows = await prisma.helpCmsCategory.findMany({
    orderBy: [{ tabGroup: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    include: { _count: { select: { articles: true } } },
  });
  return rows.map(toCategoryDto);
}

export async function listHelpCmsCategoriesPublic(tabGroup: string): Promise<HelpCmsCategoryDto[]> {
  const rows = await prisma.helpCmsCategory.findMany({
    where: { tabGroup, isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    include: {
      _count: {
        select: {
          articles: { where: { isPublished: true } },
        },
      },
    },
  });
  return rows
    .filter((r) => (r._count?.articles ?? 0) > 0 || r.slug === 'legacy-usage')
    .map(toCategoryDto);
}

export async function createHelpCmsCategory(input: {
  slug?: string;
  label: string;
  description?: string | null;
  tabGroup: string;
  sortOrder?: number;
  isPublished?: boolean;
}): Promise<HelpCmsCategoryDto> {
  const label = input.label.trim();
  if (!label) throw new Error('LABEL_REQUIRED');
  const tabGroup = parseHelpCmsTabGroup(input.tabGroup);
  if (!tabGroup) throw new Error('INVALID_TAB_GROUP');
  const slug = normalizeHelpCmsSlug(input.slug) ?? slugFromTitle(label);
  const existing = await prisma.helpCmsCategory.findUnique({ where: { slug } });
  if (existing) throw new Error('SLUG_TAKEN');

  const maxOrder = await prisma.helpCmsCategory.aggregate({
    where: { tabGroup },
    _max: { sortOrder: true },
  });

  const row = await prisma.helpCmsCategory.create({
    data: {
      slug,
      label,
      description: input.description?.trim() || null,
      tabGroup,
      sortOrder: input.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      isPublished: input.isPublished ?? true,
    },
    include: { _count: { select: { articles: true } } },
  });
  return toCategoryDto(row);
}

export async function updateHelpCmsCategory(
  id: string,
  input: {
    slug?: string;
    label?: string;
    description?: string | null;
    tabGroup?: string;
    sortOrder?: number;
    isPublished?: boolean;
  },
): Promise<HelpCmsCategoryDto> {
  const current = await prisma.helpCmsCategory.findUnique({ where: { id } });
  if (!current) throw new Error('NOT_FOUND');

  let slug: string | undefined;
  if (input.slug !== undefined) {
    const next = normalizeHelpCmsSlug(input.slug);
    if (!next) throw new Error('INVALID_SLUG');
    if (next !== current.slug) {
      const dup = await prisma.helpCmsCategory.findUnique({ where: { slug: next } });
      if (dup) throw new Error('SLUG_TAKEN');
    }
    slug = next;
  }

  let tabGroup: string | undefined;
  if (input.tabGroup !== undefined) {
    const parsed = parseHelpCmsTabGroup(input.tabGroup);
    if (!parsed) throw new Error('INVALID_TAB_GROUP');
    tabGroup = parsed;
  }

  const row = await prisma.helpCmsCategory.update({
    where: { id },
    data: {
      ...(slug !== undefined ? { slug } : {}),
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(tabGroup !== undefined ? { tabGroup } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    },
    include: { _count: { select: { articles: true } } },
  });
  return toCategoryDto(row);
}

export async function deleteHelpCmsCategory(id: string): Promise<void> {
  const current = await prisma.helpCmsCategory.findUnique({
    where: { id },
    include: { _count: { select: { articles: true } } },
  });
  if (!current) throw new Error('NOT_FOUND');
  if ((current._count?.articles ?? 0) > 0) throw new Error('HAS_ARTICLES');
  await prisma.helpCmsCategory.delete({ where: { id } });
}

export async function reorderHelpCmsCategories(
  tabGroup: string,
  orderedIds: string[],
): Promise<HelpCmsCategoryDto[]> {
  const parsed = parseHelpCmsTabGroup(tabGroup);
  if (!parsed) throw new Error('INVALID_TAB_GROUP');
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.helpCmsCategory.updateMany({
        where: { id, tabGroup: parsed },
        data: { sortOrder: index },
      }),
    ),
  );
  return listHelpCmsCategoriesPlatform().then((items) =>
    items.filter((c) => c.tabGroup === parsed),
  );
}

export async function listHelpCmsArticlesPlatform(params: {
  categoryId?: string;
  tabGroup?: string;
  q?: string;
  limit: number;
  offset: number;
}): Promise<{ items: HelpCmsArticleListItem[]; total: number }> {
  const where: import('@prisma/client').Prisma.HelpCmsArticleWhereInput = {};
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.tabGroup) {
    const tab = parseHelpCmsTabGroup(params.tabGroup);
    if (!tab) throw new Error('INVALID_TAB_GROUP');
    where.category = { tabGroup: tab };
  }
  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.helpCmsArticle.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      skip: params.offset,
      take: params.limit,
      include: ARTICLE_INCLUDE,
    }),
    prisma.helpCmsArticle.count({ where }),
  ]);

  return {
    items: rows.map((r) => toListItem(toArticleDto(r))),
    total,
  };
}

export async function listHelpCmsArticlesPublic(params: {
  categorySlug: string;
  limit: number;
  offset: number;
}): Promise<{ items: HelpCmsArticleListItem[]; total: number }> {
  const category = await prisma.helpCmsCategory.findFirst({
    where: { slug: params.categorySlug, isPublished: true },
  });
  if (!category) return { items: [], total: 0 };

  const where = { categoryId: category.id, isPublished: true };
  const [rows, total] = await Promise.all([
    prisma.helpCmsArticle.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { title: 'asc' }],
      skip: params.offset,
      take: params.limit,
      include: ARTICLE_INCLUDE,
    }),
    prisma.helpCmsArticle.count({ where }),
  ]);

  return {
    items: rows.map((r) => toListItem(toArticleDto(r))),
    total,
  };
}

export async function getHelpCmsArticlePlatform(id: string): Promise<HelpCmsArticleDto> {
  const row = await prisma.helpCmsArticle.findUnique({
    where: { id },
    include: ARTICLE_INCLUDE,
  });
  if (!row) throw new Error('NOT_FOUND');
  return toArticleDto(row);
}

export async function getHelpCmsArticleBySlugPlatform(
  slug: string,
  includeUnpublished: boolean,
): Promise<HelpCmsArticleDto> {
  const row = await prisma.helpCmsArticle.findUnique({
    where: { slug },
    include: ARTICLE_INCLUDE,
  });
  if (!row) throw new Error('NOT_FOUND');
  if (!includeUnpublished && !row.isPublished) throw new Error('NOT_FOUND');
  if (!includeUnpublished && !row.category.isPublished) throw new Error('NOT_FOUND');
  return toArticleDto(row);
}

export async function getHelpCmsArticlePublic(slug: string): Promise<HelpCmsArticleDto> {
  return getHelpCmsArticleBySlugPlatform(slug, false);
}

async function resolveUniqueArticleSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base.slice(0, 120);
  let n = 0;
  while (true) {
    const existing = await prisma.helpCmsArticle.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) return candidate;
    n += 1;
    candidate = `${base.slice(0, 110)}-${n}`;
  }
}

export async function createHelpCmsArticle(
  authorPlatformUserId: string,
  input: {
    categoryId: string;
    slug?: string;
    title: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    bodyHtml?: string;
    bodyMarkdown?: string | null;
    contentFormat?: HelpCmsContentFormat | string;
    sortOrder?: number;
    isPublished?: boolean;
  },
): Promise<HelpCmsArticleDto> {
  const title = input.title.trim();
  if (!title) throw new Error('TITLE_REQUIRED');
  const body = normalizeArticleBody(input);

  const category = await prisma.helpCmsCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new Error('CATEGORY_NOT_FOUND');

  const baseSlug = normalizeHelpCmsSlug(input.slug) ?? slugFromTitle(title);
  const slug = await resolveUniqueArticleSlug(baseSlug);

  const maxOrder = await prisma.helpCmsArticle.aggregate({
    where: { categoryId: input.categoryId },
    _max: { sortOrder: true },
  });

  const isPublished = input.isPublished ?? false;
  const row = await prisma.helpCmsArticle.create({
    data: {
      categoryId: input.categoryId,
      slug,
      title,
      excerpt: input.excerpt?.trim().slice(0, 500) || null,
      coverImageUrl: input.coverImageUrl?.trim() || null,
      bodyHtml: body.bodyHtml,
      bodyMarkdown: body.bodyMarkdown,
      contentFormat: body.contentFormat,
      sortOrder: input.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      authorPlatformUserId,
    },
    include: ARTICLE_INCLUDE,
  });
  return toArticleDto(row);
}

export async function updateHelpCmsArticle(
  id: string,
  input: {
    categoryId?: string;
    slug?: string;
    title?: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    bodyHtml?: string;
    bodyMarkdown?: string | null;
    contentFormat?: HelpCmsContentFormat | string;
    sortOrder?: number;
    isPublished?: boolean;
  },
): Promise<HelpCmsArticleDto> {
  const current = await prisma.helpCmsArticle.findUnique({ where: { id } });
  if (!current) throw new Error('NOT_FOUND');

  if (input.categoryId) {
    const category = await prisma.helpCmsCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new Error('CATEGORY_NOT_FOUND');
  }

  let slug: string | undefined;
  if (input.slug !== undefined) {
    const base = normalizeHelpCmsSlug(input.slug);
    if (!base) throw new Error('INVALID_SLUG');
    slug = base === current.slug ? base : await resolveUniqueArticleSlug(base, id);
  }

  let bodyPatch:
    | { bodyHtml: string; bodyMarkdown: string | null; contentFormat: HelpCmsContentFormat }
    | undefined;
  if (
    input.bodyHtml !== undefined ||
    input.bodyMarkdown !== undefined ||
    input.contentFormat !== undefined
  ) {
    bodyPatch = normalizeArticleBody({
      contentFormat: input.contentFormat ?? current.contentFormat,
      bodyHtml: input.bodyHtml ?? current.bodyHtml,
      bodyMarkdown: input.bodyMarkdown ?? current.bodyMarkdown,
    });
  }

  let publishedAt: Date | null | undefined;
  if (input.isPublished !== undefined) {
    if (input.isPublished && !current.isPublished) publishedAt = new Date();
    if (!input.isPublished) publishedAt = null;
  }

  const row = await prisma.helpCmsArticle.update({
    where: { id },
    data: {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt?.trim().slice(0, 500) || null } : {}),
      ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl?.trim() || null } : {}),
      ...(bodyPatch
        ? {
            bodyHtml: bodyPatch.bodyHtml,
            bodyMarkdown: bodyPatch.bodyMarkdown,
            contentFormat: bodyPatch.contentFormat,
          }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
    },
    include: ARTICLE_INCLUDE,
  });
  return toArticleDto(row);
}

export async function deleteHelpCmsArticle(
  id: string,
  actor: { platformUserId: string; role: PlatformRole },
): Promise<void> {
  const row = await prisma.helpCmsArticle.findUnique({ where: { id } });
  if (!row) throw new Error('NOT_FOUND');
  if (actor.role !== 'SUPER_ADMIN' && row.authorPlatformUserId !== actor.platformUserId) {
    throw new Error('FORBIDDEN');
  }
  await prisma.helpCmsArticle.delete({ where: { id } });
}

export function mapHelpCmsError(msg: string): { status: number; error: string } {
  switch (msg) {
    case 'NOT_FOUND':
      return { status: 404, error: '항목을 찾을 수 없습니다.' };
    case 'FORBIDDEN':
      return { status: 403, error: '권한이 없습니다.' };
    case 'SLUG_TAKEN':
    case 'INVALID_SLUG':
      return { status: 400, error: '주소(slug) 형식을 확인해 주세요. (영문 소문자·숫자·하이픈)' };
    case 'LABEL_REQUIRED':
    case 'TITLE_REQUIRED':
    case 'CONTENT_REQUIRED':
      return { status: 400, error: '필수 항목을 입력해 주세요.' };
    case 'INVALID_TAB_GROUP':
      return { status: 400, error: '탭 그룹은 usage 또는 notice만 가능합니다.' };
    case 'CATEGORY_NOT_FOUND':
      return { status: 400, error: '카테고리를 찾을 수 없습니다.' };
    case 'HAS_ARTICLES':
      return { status: 409, error: '글이 있는 카테고리는 삭제할 수 없습니다.' };
    default:
      return { status: 500, error: '처리에 실패했습니다.' };
  }
}
