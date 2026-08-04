import { HelpUiEmbed } from '../help/ui/helpUiRegistry';
import { isHelpUiTokenId } from '@shared/helpUiTokens';

const UI_EMBED_RE = /<(?:div|span)[^>]*\sdata-help-ui="([^"]+)"[^>]*>\s*<\/(?:div|span)>/gi;

type HtmlPart = { kind: 'html'; html: string } | { kind: 'ui'; tokenId: string };

function splitHelpCmsHtmlParts(html: string): HtmlPart[] {
  const parts: HtmlPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  UI_EMBED_RE.lastIndex = 0;
  while ((match = UI_EMBED_RE.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'html', html: html.slice(lastIndex, match.index) });
    }
    parts.push({ kind: 'ui', tokenId: (match[1] ?? '').trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    parts.push({ kind: 'html', html: html.slice(lastIndex) });
  }

  return parts.length ? parts : [{ kind: 'html', html }];
}

const ARTICLE_CLASS =
  'help-cms-article-body prose prose-slate max-w-none text-fluid-sm leading-relaxed prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-img:rounded-xl prose-img:shadow-sm prose-a:text-sky-700';

/** 도움말 CMS 본문 HTML — 플랫폼·공개 /help 공통 (표·UI 목업 포함) */
export function HelpCmsArticleBody({ html }: { html: string }) {
  const parts = splitHelpCmsHtmlParts(html);

  return (
    <>
      <style>{`
        .help-cms-article-body table.help-cms-md-table,
        .help-cms-article-body table {
          width: 100%;
          min-width: 280px;
          border-collapse: collapse;
        }
        .help-cms-article-body table th,
        .help-cms-article-body table td {
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          text-align: center;
          vertical-align: middle;
        }
        .help-cms-article-body table th {
          background: #f8fafc;
          font-weight: 600;
        }
        .help-cms-article-body blockquote {
          border-left: 4px solid #cbd5e1;
          padding-left: 1rem;
          color: #334155;
        }
      `}</style>
      <article className={ARTICLE_CLASS}>
        {parts.map((part, index) => {
          if (part.kind === 'ui') {
            if (isHelpUiTokenId(part.tokenId)) {
              return (
                <div key={`ui-${index}`} className="my-3 not-prose">
                  <HelpUiEmbed tokenId={part.tokenId} />
                </div>
              );
            }
            return (
              <p key={`ui-bad-${index}`} className="text-fluid-2xs text-amber-700">
                알 수 없는 UI: {part.tokenId}
              </p>
            );
          }
          return (
            <HelpCmsArticleHtmlChunk key={`html-${index}`} html={part.html} />
          );
        })}
      </article>
    </>
  );
}

function HelpCmsArticleHtmlChunk({ html }: { html: string }) {
  if (!html.trim()) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
