import { Link } from 'react-router-dom';
import { HelpCategoryIcon } from './HelpCategoryIcon';
import { helpUsageHomePath, helpUsageSectionPath } from './helpCmsUsagePaths';

type Props = {
  sectionSlug?: string | null;
  sectionLabel?: string | null;
  articleTitle?: string | null;
  /** 분류 화면: 아래 여백 없이 작은 글자로 */
  compact?: boolean;
};

const HOME_LINK = 'font-semibold text-[#0284c7] hover:text-sky-800 hover:underline';
const CRUMB = 'text-slate-600';
const SEP = 'mx-1.5 text-slate-400';

/** 사용법 홈 › 분류 › 글 — 앞 두 칸은 링크 */
export function HelpCmsUsageBreadcrumb({ sectionSlug, sectionLabel, articleTitle, compact = false }: Props) {
  return (
    <nav
      aria-label="경로"
      className={`flex flex-wrap items-center leading-snug ${compact ? 'text-fluid-xs' : 'mb-4 text-fluid-sm'}`}
    >
      <Link to={helpUsageHomePath()} className={HOME_LINK}>
        사용법 홈
      </Link>
      {sectionSlug && sectionLabel ? (
        <>
          <span className={SEP} aria-hidden>
            ›
          </span>
          {articleTitle ? (
            <Link
              to={helpUsageSectionPath(sectionSlug)}
              className={`${HOME_LINK} inline-flex items-center gap-1.5`}
            >
              <HelpCategoryIcon slug={sectionSlug} size={18} />
              {sectionLabel}
            </Link>
          ) : (
            <span className={`${CRUMB} font-medium text-slate-800`}>{sectionLabel}</span>
          )}
        </>
      ) : null}
      {articleTitle ? (
        <>
          <span className={SEP} aria-hidden>
            ›
          </span>
          <span className={`${CRUMB} font-medium text-slate-800`}>{articleTitle}</span>
        </>
      ) : null}
    </nav>
  );
}
