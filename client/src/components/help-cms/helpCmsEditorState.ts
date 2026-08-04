import { helpCmsMarkdownToHtml } from './helpCmsMarkdownToHtml';

/** CMS 글 편집 — WYSIWYG(HTML) 단일 편집기, 레거시 마크다운은 열 때 HTML로 변환 */
export function applyHelpCmsArticleToEditorState(row: {
  categoryId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  bodyHtml: string;
  bodyMarkdown: string | null;
  contentFormat?: string | null;
  isPublished: boolean;
}) {
  const md = (row.bodyMarkdown ?? '').trim();
  const html = (row.bodyHtml ?? '').trim();
  const hasHtml = html && html !== '<p></p>';
  const useMarkdown = row.contentFormat === 'markdown' && md;

  let bodyHtmlForEditor = hasHtml ? row.bodyHtml : '<p></p>';
  if (!hasHtml && md) {
    bodyHtmlForEditor = helpCmsMarkdownToHtml(md);
  } else if (useMarkdown && md) {
    bodyHtmlForEditor = helpCmsMarkdownToHtml(md);
  }

  return {
    categoryId: row.categoryId,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? '',
    coverImageUrl: row.coverImageUrl ?? '',
    bodyHtml: bodyHtmlForEditor,
    bodyMarkdown: row.bodyMarkdown ?? '',
    contentFormat: 'html' as const,
    isPublished: row.isPublished,
    convertedFromMarkdown: Boolean(useMarkdown || (!hasHtml && md)),
  };
}
