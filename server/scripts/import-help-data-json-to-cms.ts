/**
 * data.json → Help CMS 「레거시 사용법」 카테고리 import
 * 실행: cd server && npx tsx scripts/import-help-data-json-to-cms.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/lib/prisma.js';
import { stripDangerousHtml } from '../src/modules/help-cms/helpCms.helpers.js';

type HelpJsonRow = {
  role: string;
  module: string;
  moduleOrder: number;
  itemOrder: number;
  title: string;
  path: string;
  screenshotFile?: string;
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

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  const flushTable = () => {
    if (!inTable) return;
    if (tableRows.length >= 1) {
      out.push('<table><tbody>');
      for (let i = 0; i < tableRows.length; i++) {
        const cells = tableRows[i]!;
        const tag = i === 0 && tableRows.length > 1 && tableRows[1]?.every((c) => /^[-:\s|]+$/.test(c))
          ? null
          : i === 0
            ? 'th'
            : 'td';
        if (tag === null) continue;
        out.push('<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>');
      }
      out.push('</tbody></table>');
    }
    tableRows = [];
    inTable = false;
  };

  const inline = (text: string): string =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
        const url = src.startsWith('http') ? src : `/help/screenshots/${encodeURIComponent(src)}`;
        return `<img src="${url}" alt="${alt}" class="max-w-full rounded-lg my-3" />`;
      })
      .replace(/\{\{ui:[^}]+\}\}/g, (m) => `<code>${m}</code>`);

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      inTable = true;
      tableRows.push(
        line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim()),
      );
      continue;
    }
    flushTable();

    if (line === '---') {
      flushList();
      out.push('<hr />');
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inUl) {
        flushList();
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (!inOl) {
        flushList();
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }
    if (line.startsWith('```')) {
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  flushTable();
  return stripDangerousHtml(out.join('\n'));
}

async function main() {
  const jsonPath = resolve(process.cwd(), '../client/public/help/data.json');
  const raw = readFileSync(jsonPath, 'utf8');
  const rows = JSON.parse(raw) as HelpJsonRow[];

  let category = await prisma.helpCmsCategory.findUnique({ where: { slug: 'legacy-usage' } });
  if (!category) {
    category = await prisma.helpCmsCategory.create({
      data: {
        slug: 'legacy-usage',
        label: '레거시 사용법',
        description: '기존 화면별 도움말(data.json)에서 가져온 글입니다. CMS에서 점진적으로 수정·분류하세요.',
        tabGroup: 'usage',
        sortOrder: 900,
        isPublished: true,
      },
    });
    console.log('Created category legacy-usage');
  }

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const slug = slugifyTitle(row.title, row.path, i);
    const existing = await prisma.helpCmsArticle.findUnique({ where: { slug } });
    if (existing) {
      await prisma.helpCmsArticle.update({
        where: { id: existing.id },
        data: {
          title: row.title,
          excerpt: row.summary?.trim().slice(0, 500) || null,
          bodyMarkdown: row.markdown,
          contentFormat: 'markdown',
          bodyHtml: '<p></p>',
          sortOrder: (row.moduleOrder ?? 0) * 1000 + (row.itemOrder ?? i),
        },
      });
      skipped += 1;
      continue;
    }
    await prisma.helpCmsArticle.create({
      data: {
        categoryId: category.id,
        slug,
        title: row.title,
        excerpt: row.summary?.trim().slice(0, 500) || null,
        bodyMarkdown: row.markdown,
        contentFormat: 'markdown',
        bodyHtml: '<p></p>',
        sortOrder: (row.moduleOrder ?? 0) * 1000 + (row.itemOrder ?? i),
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    imported += 1;
  }

  console.log(`Import done: ${imported} created, ${skipped} updated (markdown source).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
