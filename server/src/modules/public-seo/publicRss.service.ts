import { listHelpCmsArticlesForRss } from '../help-cms/helpCms.service.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import {
  escapeXml,
  helpArticlePublicUrl,
  plainTextFromHtml,
  toRfc822,
} from './publicRss.helpers.js';

const CHANNEL_TITLE = '청소비서';
const CHANNEL_DESCRIPTION =
  'AI를 이용한 스케줄·접수. 타임트리·구글캘린더 대체, 청소업체 전용 고객관리 캘린더';

type RssItem = {
  title: string;
  link: string;
  guid: string;
  description: string;
  pubDate: Date;
  imageUrl?: string | null;
};

function buildRssItemXml(item: RssItem): string {
  const enclosure =
    item.imageUrl && /^https?:\/\//i.test(item.imageUrl)
      ? `\n    <enclosure url="${escapeXml(item.imageUrl)}" type="image/jpeg" />`
      : '';
  return `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
    <description>${escapeXml(item.description)}</description>
    <pubDate>${toRfc822(item.pubDate)}</pubDate>${enclosure}
  </item>`;
}

export async function buildPublicRssXml(): Promise<string> {
  const baseUrl = getPublicAppBaseUrl();
  const feedUrl = `${baseUrl}/feed.xml`;
  const articles = await listHelpCmsArticlesForRss(50);

  const items: RssItem[] = [
    {
      title: '청소비서 — AI를 이용한 빠른 접수·스케줄',
      link: `${baseUrl}/`,
      guid: `${baseUrl}/`,
      description:
        '타임트리·구글 캘린더 대신 쓰는 청소업체 전용 CRM. AI로 접수·일정을 빠르게 등록하고 현장·정산까지 한 번에 관리합니다.',
      pubDate: new Date(),
      imageUrl: `${baseUrl}/icons/app-icon-512.png`,
    },
    ...articles.map((row) => {
      const link = helpArticlePublicUrl(baseUrl, row.tabGroup, row.categorySlug, row.slug);
      const pubDate = row.publishedAt ?? row.updatedAt;
      const description =
        row.excerpt?.trim() ||
        plainTextFromHtml(row.bodyHtml, 500) ||
        `${row.title} — 청소비서 도움말`;
      return {
        title: row.title,
        link,
        guid: link,
        description,
        pubDate,
        imageUrl: row.coverImageUrl,
      };
    }),
  ];

  const lastBuildDate = items.reduce(
    (latest, item) => (item.pubDate > latest ? item.pubDate : latest),
    items[0]?.pubDate ?? new Date(),
  );

  const itemXml = items.map(buildRssItemXml).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(CHANNEL_TITLE)}</title>
  <link>${escapeXml(`${baseUrl}/help`)}</link>
  <description>${escapeXml(CHANNEL_DESCRIPTION)}</description>
  <language>ko</language>
  <lastBuildDate>${toRfc822(lastBuildDate)}</lastBuildDate>
  <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
  <image>
    <url>${escapeXml(`${baseUrl}/icons/app-icon-512.png`)}</url>
    <title>${escapeXml(CHANNEL_TITLE)}</title>
    <link>${escapeXml(`${baseUrl}/`)}</link>
  </image>
${itemXml}
</channel>
</rss>`;
}
