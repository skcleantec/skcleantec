import { helpArticleHref, resolveHelpArticleLink } from '@shared/helpArticleLinks';

/** 앱 안 도움말 모달·? 메뉴 — CMS 글 새 탭 */
export function HelpCmsDeepLink({
  pathname,
  className = '',
}: {
  pathname: string;
  className?: string;
}) {
  const link = resolveHelpArticleLink(pathname);
  if (!link) return null;
  return (
    <a
      href={helpArticleHref(link)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        'inline-flex items-center text-fluid-sm font-semibold text-sky-700 hover:text-sky-800 hover:underline'
      }
    >
      도움말에서 자세히 보기 →
    </a>
  );
}
