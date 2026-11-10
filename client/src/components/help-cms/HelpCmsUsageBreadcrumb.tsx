import { Link } from 'react-router-dom';
import { helpUsageHomePath, helpUsageSectionPath } from './helpCmsUsagePaths';

type Props = {
  sectionSlug?: string | null;
  sectionLabel?: string | null;
  articleTitle?: string | null;
};

const HOME_LINK =
  'text-[14px] font-semibold text-[#0284c7] hover:text-sky-800 hover:underline';
const CRUMB = 'text-[14px] text-slate-600';
const SEP = 'mx-1.5 text-slate-400';

/** 사용법 홈 › 분류 › 글 — 앞 두 칸은 링크 */
export function HelpCmsUsageBreadcrumb({ sectionSlug, sectionLabel, articleTitle }: Props) {
  return (
    <nav aria-label="경로" className="mb-4 flex flex-wrap items-center leading-snug">
      <Link to={helpUsageHomePath()} className={HOME_LINK}>
        사용법 홈
      </Link>
      {sectionSlug && sectionLabel ? (
        <>
          <span className={SEP} aria-hidden>
            ›
          </span>
          {articleTitle ? (
            <Link to={helpUsageSectionPath(sectionSlug)} className={HOME_LINK}>
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
