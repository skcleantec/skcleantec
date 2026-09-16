import { getHelpCmsArticlePublic } from '../help-cms/helpCms.service.js';
import { getIndexableNoticePostForSeo } from '../platform-board/platformBoard.service.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { helpArticlePublicUrl, helpNoticePublicUrl, plainTextFromHtml } from './publicRss.helpers.js';

type HelpQuery = {
  category?: unknown;
  post?: unknown;
  article?: unknown;
  section?: unknown;
};

type HelpSeoPage = {
  indexable: boolean;
  title: string;
  description: string;
  canonical: string;
  publishedAt?: string | null;
};

function queryStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function upsertMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const re = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escapeHtmlAttr(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function upsertTitle(html: string, title: string): string {
  const safe = escapeHtmlAttr(title);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`);
  }
  return html.replace(/<\/head>/i, `    <title>${safe}</title>\n  </head>`);
}

function upsertCanonical(html: string, href: string): string {
  const tag = `<link rel="canonical" href="${escapeHtmlAttr(href)}" />`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

export async function resolveHelpPublicSeo(query: HelpQuery): Promise<HelpSeoPage> {
  const baseUrl = getPublicAppBaseUrl();
  const category = queryStr(query.category) || 'usage';
  const postId = queryStr(query.post);
  const articleSlug = queryStr(query.article);
  const section = queryStr(query.section);

  if (category === 'inquiry') {
    return {
      indexable: false,
      title: '고객문의 | 청소비서',
      description: '청소비서 고객문의. 로그인 후 문의를 남길 수 있습니다.',
      canonical: `${baseUrl}/help?category=inquiry`,
    };
  }

  if (postId && category === 'notice') {
    const post = await getIndexableNoticePostForSeo(postId);
    if (post) {
      const description =
        post.excerpt?.trim() ||
        plainTextFromHtml(post.bodyHtml, 160) ||
        `${post.title} — 청소비서 공지`;
      return {
        indexable: true,
        title: `${post.title} | 청소비서`,
        description,
        canonical: helpNoticePublicUrl(baseUrl, post.id),
        publishedAt: (post.publishedAt ?? post.updatedAt).toISOString(),
      };
    }
  }

  if (articleSlug) {
    try {
      const article = await getHelpCmsArticlePublic(articleSlug);
      const description =
        article.excerpt?.trim() ||
        plainTextFromHtml(article.bodyHtml, 160) ||
        `${article.title} — 청소비서 도움말`;
      return {
        indexable: true,
        title: `${article.title} | 청소비서`,
        description,
        canonical: helpArticlePublicUrl(baseUrl, article.tabGroup, article.categorySlug, article.slug),
        publishedAt: article.publishedAt,
      };
    } catch {
      /* 없는 글은 목록 메타 */
    }
  }

  if (category === 'notice') {
    return {
      indexable: true,
      title: '공지사항 | 청소비서',
      description: '청소비서 서비스 공지와 업데이트 안내.',
      canonical: `${baseUrl}/help?category=notice`,
    };
  }

  if (articleSlug || section) {
    return {
      indexable: true,
      title: '사용법 | 청소비서',
      description: '청소비서 사용법 — 접수·배정·정산을 화면 그대로 안내합니다.',
      canonical: `${baseUrl}/help?category=usage`,
    };
  }

  return {
    indexable: true,
    title: '도움말 | 청소비서',
    description: '청소비서 사용법·공지사항. 청소업체 업무관리 SaaS 안내.',
    canonical: `${baseUrl}/help`,
  };
}

export async function applyHelpPublicSeoHtml(indexHtml: string, query: HelpQuery): Promise<string> {
  const seo = await resolveHelpPublicSeo(query);
  let html = indexHtml;
  html = upsertMeta(html, 'name', 'robots', seo.indexable ? 'index,follow' : 'noindex,nofollow');
  html = upsertTitle(html, seo.title);
  html = upsertMeta(html, 'name', 'description', seo.description);
  html = upsertMeta(html, 'property', 'og:title', seo.title);
  html = upsertMeta(html, 'property', 'og:description', seo.description);
  html = upsertMeta(html, 'property', 'og:url', seo.canonical);
  html = upsertCanonical(html, seo.canonical);

  if (seo.indexable && seo.publishedAt) {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: seo.title.replace(/\s*\|\s*청소비서$/, ''),
      description: seo.description,
      datePublished: seo.publishedAt,
      mainEntityOfPage: seo.canonical,
      publisher: { '@type': 'Organization', name: '청소비서', url: getPublicAppBaseUrl() },
    };
    const script = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    html = html.replace(/<\/head>/i, `    ${script}\n  </head>`);
    const noscript = `<noscript><article><h1>${escapeHtmlAttr(seo.title)}</h1><p>${escapeHtmlAttr(seo.description)}</p></article></noscript>`;
    html = html.replace(/<div id="root"><\/div>/i, `<div id="root"></div>\n    ${noscript}`);
  }

  return html;
}
