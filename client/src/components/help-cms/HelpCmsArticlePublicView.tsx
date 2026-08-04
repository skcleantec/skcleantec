import { HelpCmsArticleContent } from './HelpCmsArticleContent';

export type HelpCmsArticlePublicViewProps = {
  title: string;
  publishedAt?: string | null;
  coverImageUrl?: string | null;
  contentFormat: 'html' | 'markdown';
  bodyHtml: string;
  bodyMarkdown: string | null;
  /** 편집 화면 — 제목 입력 (공개 /help h1 과 동일 스타일) */
  editableTitle?: boolean;
  onTitleChange?: (next: string) => void;
  titlePlaceholder?: string;
};

/** 공개 /help CMS 글 상세와 동일 레이아웃·렌더 (SimpleMarkdown·표·UI토큰·인용 등) */
export function HelpCmsArticlePublicView({
  title,
  publishedAt,
  coverImageUrl,
  contentFormat,
  bodyHtml,
  bodyMarkdown,
  editableTitle = false,
  onTitleChange,
  titlePlaceholder = '제목을 입력하세요',
}: HelpCmsArticlePublicViewProps) {
  return (
    <>
      {editableTitle ? (
        <label className="block">
          <span className="sr-only">제목</span>
          <input
            className="w-full border-0 bg-transparent p-0 text-2xl font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder={titlePlaceholder}
          />
        </label>
      ) : (
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      )}

      {publishedAt ? (
        <p className="mt-1 text-fluid-2xs text-slate-500">
          {new Date(publishedAt).toLocaleDateString('ko-KR')}
        </p>
      ) : null}

      {coverImageUrl?.trim() ? (
        <img
          src={coverImageUrl.trim()}
          alt=""
          className="mt-4 max-h-80 w-full rounded-xl object-cover"
        />
      ) : null}

      <div className="mt-6">
        <HelpCmsArticleContent
          contentFormat={contentFormat}
          bodyHtml={bodyHtml}
          bodyMarkdown={bodyMarkdown}
        />
      </div>
    </>
  );
}
