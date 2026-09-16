import { listHelpCmsArticlesForSitemap } from '../help-cms/helpCms.service.js';
import { listIndexableNoticePostsForSeo } from '../platform-board/platformBoard.service.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import {
  escapeXml,
  helpArticlePublicUrl,
  helpNoticePublicUrl,
  toSitemapLastmod,
} from './publicRss.helpers.js';

type SitemapUrl = {
  loc: string;
  lastmod?: Date;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
};

function urlXml(item: SitemapUrl): string {
  const lastmod = item.lastmod
    ? `\n    <lastmod>${escapeXml(toSitemapLastmod(item.lastmod))}</lastmod>`
    : '';
  const changefreq = item.changefreq
    ? `\n    <changefreq>${item.changefreq}</changefreq>`
    : '';
  const priority = item.priority ? `\n    <priority>${item.priority}</priority>` : '';
  return `  <url>
    <loc>${escapeXml(item.loc)}</loc>${lastmod}${changefreq}${priority}
  </url>`;
}

export async function buildPublicSitemapXml(): Promise<string> {
  const baseUrl = getPublicAppBaseUrl();
  const [articles, notices] = await Promise.all([
    listHelpCmsArticlesForSitemap(500),
    listIndexableNoticePostsForSeo(200),
  ]);

  const urls: SitemapUrl[] = [
    { loc: `${baseUrl}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${baseUrl}/help`, changefreq: 'weekly', priority: '0.8' },
    {
      loc: `${baseUrl}/help?category=usage`,
      changefreq: 'weekly',
      priority: '0.7',
    },
    {
      loc: `${baseUrl}/help?category=notice`,
      changefreq: 'daily',
      priority: '0.8',
    },
    { loc: `${baseUrl}/education`, changefreq: 'weekly', priority: '0.8' },
    ...articles.map((row) => ({
      loc: helpArticlePublicUrl(baseUrl, row.tabGroup, row.categorySlug, row.slug),
      lastmod: row.updatedAt,
      changefreq: 'weekly' as const,
      priority: '0.7',
    })),
    ...notices.map((row) => ({
      loc: helpNoticePublicUrl(baseUrl, row.id),
      lastmod: row.updatedAt,
      changefreq: 'weekly' as const,
      priority: '0.8',
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlXml).join('\n')}
</urlset>
`;
}
