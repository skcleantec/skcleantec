import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';

export type HelpCmsSearchHit = {
  slug: string;
  title: string;
  excerpt: string | null;
  categorySlug: string;
  categoryLabel: string;
};

function stripHtml(html: string): string {
  return String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 공백 분리, 1글자 제외, 최대 5개 */
export function tokenizeHelpSearchQuery(qRaw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of qRaw.trim().slice(0, 120).split(/\s+/)) {
    const t = part.trim().toLowerCase();
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

function scoreToken(
  needle: string,
  row: { title: string; excerpt: string | null; keywords: string[]; bodyText: string },
): number {
  let score = 0;
  if (row.title.toLowerCase().includes(needle)) score += 100;
  if (row.keywords.some((k) => k.toLowerCase().includes(needle))) score += 50;
  if ((row.excerpt ?? '').toLowerCase().includes(needle)) score += 30;
  if (row.bodyText.includes(needle)) score += 10;
  return score;
}

type Scored = {
  r: {
    slug: string;
    title: string;
    excerpt: string | null;
    category: { slug: string; label: string };
  };
  matched: number;
  score: number;
};

/** 공개 usage 분류의 공개 글만 검색 — 단어별 매칭 + 가중치 */
export async function searchHelpCmsArticlesPublic(
  qRaw: string,
  limit = 20,
): Promise<{ items: HelpCmsSearchHit[] }> {
  const tokens = tokenizeHelpSearchQuery(qRaw);
  if (tokens.length === 0) return { items: [] };

  const rows = await prisma.helpCmsArticle.findMany({
    where: {
      isPublished: true,
      category: { isPublished: true, tabGroup: 'usage' },
    },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      keywords: true,
      bodyHtml: true,
      category: { select: { slug: true, label: true } },
    },
  });

  const scored: Scored[] = [];
  for (const r of rows) {
    const bodyText = stripHtml(r.bodyHtml).toLowerCase();
    const fields = {
      title: r.title,
      excerpt: r.excerpt,
      keywords: r.keywords ?? [],
      bodyText,
    };
    let matched = 0;
    let score = 0;
    for (const token of tokens) {
      const s = scoreToken(token, fields);
      if (s > 0) {
        matched += 1;
        score += s;
      }
    }
    if (matched === 0) continue;
    scored.push({ r, matched, score });
  }

  scored.sort((a, b) => {
    if (b.matched !== a.matched) return b.matched - a.matched;
    if (b.score !== a.score) return b.score - a.score;
    return a.r.title.localeCompare(b.r.title, 'ko');
  });

  return {
    items: scored.slice(0, Math.min(50, Math.max(1, limit))).map(({ r }) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      categorySlug: r.category.slug,
      categoryLabel: r.category.label,
    })),
  };
}

export function helpCmsFeedbackClientHash(ip: string, ua: string): string {
  return createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 64);
}

export async function submitHelpCmsArticleFeedback(input: {
  slug: string;
  helpful: boolean;
  clientHash: string;
}): Promise<{ ok: true; alreadySubmitted?: boolean }> {
  const article = await prisma.helpCmsArticle.findFirst({
    where: {
      slug: input.slug,
      isPublished: true,
      category: { isPublished: true },
    },
    select: { id: true },
  });
  if (!article) throw new Error('NOT_FOUND');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.helpCmsArticleFeedback.findFirst({
    where: {
      articleId: article.id,
      clientHash: input.clientHash,
      createdAt: { gte: since },
    },
  });
  if (existing) return { ok: true, alreadySubmitted: true };

  await prisma.helpCmsArticleFeedback.create({
    data: {
      articleId: article.id,
      helpful: input.helpful,
      clientHash: input.clientHash,
    },
  });
  return { ok: true };
}

export async function countHelpCmsFeedbackByArticleIds(
  articleIds: string[],
): Promise<Map<string, { yes: number; no: number }>> {
  const map = new Map<string, { yes: number; no: number }>();
  if (articleIds.length === 0) return map;
  for (const id of articleIds) map.set(id, { yes: 0, no: 0 });

  const rows = await prisma.helpCmsArticleFeedback.groupBy({
    by: ['articleId', 'helpful'],
    where: { articleId: { in: articleIds } },
    _count: { _all: true },
  });
  for (const row of rows) {
    const cur = map.get(row.articleId) ?? { yes: 0, no: 0 };
    if (row.helpful) cur.yes = row._count._all;
    else cur.no = row._count._all;
    map.set(row.articleId, cur);
  }
  return map;
}
