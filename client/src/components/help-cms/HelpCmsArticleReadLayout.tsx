import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  HELP_CMS_ARTICLE_CARD,
  HELP_CMS_BROWSE_ROW,
  HELP_CMS_MAIN_COLUMN,
  HELP_CMS_SIDEBAR_ASIDE,
  HELP_CMS_SIDEBAR_ITEM_ACTIVE,
  HELP_CMS_SIDEBAR_ITEM_IDLE,
  HELP_CMS_SIDEBAR_LABEL,
  type HelpCmsSidebarArticleItem,
  type HelpCmsSidebarItem,
} from './helpCmsArticleLayout';
import { HelpCmsMobileNavBar } from './HelpCmsMobileNavBar';
import { helpUsageHomePath } from './helpCmsUsagePaths';

export type { HelpCmsSidebarArticleItem, HelpCmsSidebarItem };

type Props = {
  sidebarLabel?: string;
  sidebarItems: HelpCmsSidebarItem[];
  articleSidebarLabel?: string;
  articleItems?: HelpCmsSidebarArticleItem[];
  articlesLoading?: boolean;
  showArticleSidebar?: boolean;
  /** 사이드바 맨 위 「사용법 홈」(PC) */
  showUsageHomeLink?: boolean;
  /** 모바일 막대에 표시할 현재 분류·글 */
  mobileSectionLabel?: string;
  mobileArticleTitle?: string | null;
  children: ReactNode;
};

export function HelpCmsArticleReadLayout({
  sidebarLabel = '카테고리',
  sidebarItems,
  articleSidebarLabel = '글',
  articleItems = [],
  articlesLoading = false,
  showArticleSidebar = false,
  showUsageHomeLink = false,
  mobileSectionLabel,
  mobileArticleTitle = null,
  children,
}: Props) {
  const homePath = helpUsageHomePath();

  const renderNavItem = (
    key: string,
    label: string,
    opts: {
      active?: boolean;
      muted?: boolean;
      href?: string;
      onSelect?: () => void;
      countEl?: ReactNode;
      idleHover: string;
    },
  ) => {
    const className = opts.active ? HELP_CMS_SIDEBAR_ITEM_ACTIVE : HELP_CMS_SIDEBAR_ITEM_IDLE;
    const extra = `${opts.active ? '' : opts.idleHover} ${opts.muted && !opts.active ? 'text-slate-500' : ''}`;

    if (opts.href) {
      return (
        <Link
          key={key}
          to={opts.href}
          title={label}
          className={`transition-colors ${className} ${extra}`}
          aria-current={opts.active ? 'page' : undefined}
        >
          <span className="line-clamp-2">{label}</span>
          {opts.countEl}
        </Link>
      );
    }

    if (opts.onSelect) {
      return (
        <button
          key={key}
          type="button"
          onClick={opts.onSelect}
          title={label}
          className={`transition-colors ${className} ${extra}`}
        >
          <span className="line-clamp-2">{label}</span>
          {opts.countEl}
        </button>
      );
    }

    return (
      <div key={key} className={`${className} ${opts.muted ? 'text-slate-500' : ''}`}>
        <span className="line-clamp-2">{label}</span>
        {opts.countEl}
      </div>
    );
  };

  const sectionLabel =
    mobileSectionLabel?.trim() ||
    sidebarItems.find((c) => c.active)?.label ||
    sidebarLabel;

  return (
    <div className={HELP_CMS_BROWSE_ROW}>
      <HelpCmsMobileNavBar
        sectionLabel={sectionLabel}
        articleTitle={mobileArticleTitle}
        sidebarItems={sidebarItems}
        articleItems={articleItems}
        articlesLoading={articlesLoading}
      />

      <aside
        className={`hidden ${HELP_CMS_SIDEBAR_ASIDE} lg:block lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:overscroll-y-contain`}
      >
        <p className={HELP_CMS_SIDEBAR_LABEL}>{sidebarLabel}</p>

        {showUsageHomeLink
          ? renderNavItem('usage-home', '← 사용법 홈', {
              href: homePath,
              idleHover: 'hover:bg-sky-50 text-[#0284c7] font-semibold ring-sky-200',
            })
          : null}

        {sidebarItems.map((item) => {
          const countEl =
            item.count != null ? (
              <span className={`ml-1 tabular-nums ${item.active ? 'text-slate-300' : 'text-slate-400'}`}>
                {item.count}
              </span>
            ) : null;
          return renderNavItem(item.id, item.label, {
            active: item.active,
            href: item.href,
            onSelect: item.onSelect,
            countEl,
            idleHover: 'hover:bg-slate-50',
          });
        })}

        {showArticleSidebar ? (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className={HELP_CMS_SIDEBAR_LABEL}>{articleSidebarLabel}</p>
            {articlesLoading ? (
              <p className="px-3 py-2 text-fluid-2xs text-slate-500">불러오는 중…</p>
            ) : articleItems.length === 0 ? (
              <p className="px-3 py-2 text-fluid-2xs text-slate-500">글이 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {articleItems.map((item) =>
                  renderNavItem(item.id, item.title, {
                    active: item.active,
                    muted: item.muted,
                    href: item.href,
                    onSelect: item.onSelect,
                    idleHover: 'hover:bg-slate-50',
                  }),
                )}
              </div>
            )}
          </div>
        ) : null}
      </aside>
      <main className={HELP_CMS_MAIN_COLUMN}>{children}</main>
    </div>
  );
}

export function HelpCmsArticleCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${HELP_CMS_ARTICLE_CARD} ${className}`.trim()}>{children}</div>;
}
