/**
 * 기존 CMS 글 → data.json 마크다운 원문으로 되돌림 (SimpleMarkdown 렌더용)
 * 실행: cd server && npx tsx scripts/backfill-help-cms-markdown-from-json.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/lib/prisma.js';

type HelpJsonRow = {
  title: string;
  path: string;
  moduleOrder: number;
  itemOrder: number;
  summary?: string;
  markdown: string;
};

function slugifyTitle(title: string, path: string, index: number): string {
  const fromPath = path
    .replace(/^\/help\/?/, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (fromPath && fromPath.length >= 2) return fromPath.slice(0, 120);
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .slice(0, 80);
  return base || `legacy-${index}`;
}

async function main() {
  const jsonPath = resolve(process.cwd(), '../client/public/help/data.json');
  const rows = JSON.parse(readFileSync(jsonPath, 'utf8')) as HelpJsonRow[];

  let updated = 0;
  let missing = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const slug = slugifyTitle(row.title, row.path, i);
    const article = await prisma.helpCmsArticle.findUnique({ where: { slug } });
    if (!article) {
      missing += 1;
      continue;
    }
    await prisma.helpCmsArticle.update({
      where: { id: article.id },
      data: {
        bodyMarkdown: row.markdown,
        contentFormat: 'markdown',
        bodyHtml: '<p></p>',
        excerpt: row.summary?.trim().slice(0, 500) || article.excerpt,
      },
    });
    updated += 1;
  }

  console.log(`Backfill done: ${updated} articles → markdown, ${missing} slugs not in CMS.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
