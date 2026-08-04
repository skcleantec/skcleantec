import { SimpleMarkdown } from '../../utils/simpleMarkdown';
import { HelpCmsArticleBody } from './HelpCmsArticleBody';
import { helpCmsMarkdownToHtml } from './helpCmsMarkdownToHtml';

export type HelpCmsArticleContentProps = {
  contentFormat: 'html' | 'markdown';
  bodyHtml: string;
  bodyMarkdown: string | null;
};

function hasRenderableHtml(bodyHtml: string): boolean {
  const trimmed = bodyHtml.trim();
  return Boolean(trimmed && trimmed !== '<p></p>');
}

/** 공개 /help — HTML(WYSIWYG) 우선, 레거시 마크다운만 SimpleMarkdown */
export function HelpCmsArticleContent({
  contentFormat,
  bodyHtml,
  bodyMarkdown,
}: HelpCmsArticleContentProps) {
  if (hasRenderableHtml(bodyHtml)) {
    return <HelpCmsArticleBody html={bodyHtml} />;
  }

  const md = (bodyMarkdown ?? '').trim();
  if (contentFormat === 'markdown' && md) {
    return <SimpleMarkdown source={bodyMarkdown!} />;
  }

  if (md) {
    return <HelpCmsArticleBody html={helpCmsMarkdownToHtml(md)} />;
  }

  return <HelpCmsArticleBody html={bodyHtml || '<p></p>'} />;
}
