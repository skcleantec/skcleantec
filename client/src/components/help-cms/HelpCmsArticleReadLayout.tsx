import type { ReactNode } from 'react';
import type { HelpCmsArticleListItem } from '../../api/platformHelpCms';
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
import { HelpCmsPcTocTree } from './HelpCmsPcTocTree';

export type { HelpCmsSidebarArticleItem, HelpCmsSidebarItem };

type Props = {
  sidebarItems: HelpCmsSidebarItem[];
  articleItems?: HelpCmsSidebarArticleItem[];
  articlesLoading?: boolean;
  /** 플랫폼 편집 미리보기용 — 예전 카드 목록 유지 */
  showArticleSidebar?: boolean;
  mobileSectionLabel?: string;
  mobileArticleTitle?: string | null;
  activeSectionSlug?: string | null;
  activeArticleSlug?: string | null;
  activeSectionArticles?: HelpCmsArticleListItem[];
  children: ReactNode;
};

function EditorSidebar({
  sidebarItems,
  articleItems,
  articlesLoading,
  showArticleSidebar,
}: {
  sidebarItems: HelpCmsSidebarItem[];
  articleItems: HelpCmsSidebarArticleItem[];
  articlesLoading: boolean;
  showArticleSidebar: boolean;
}) {
  return (
    <aside
      className={`hidden ${HELP_CMS_SIDEBAR_ASIDE} space-y-1 lg:block lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto`}
    >
      <p className={HELP_CMS_SIDEBAR_LABEL}>카테고리</p>
      {sidebarItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onSelect}
          className={item.active ? HELP_CMS_SIDEBAR_ITEM_ACTIVE : HELP_CMS_SIDEBAR_ITEM_IDLE}
        >
          <span className="line-clamp-2">{item.label}</span>
          {item.count != null ? (
            <span className={`ml-1 tabular-nums ${item.active ? 'text-slate-300' : 'text-slate-400'}`}>
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
      {showArticleSidebar ? (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className={HELP_CMS_SIDEBAR_LABEL}>글</p>
          {articlesLoading ? (
            <p className="px-3 py-2 text-fluid-2xs text-slate-500">불러오는 중…</p>
          ) : articleItems.length === 0 ? (
            <p className="px-3 py-2 text-fluid-2xs text-slate-500">글이 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {articleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onSelect}
                  className={`${item.active ? HELP_CMS_SIDEBAR_ITEM_ACTIVE : HELP_CMS_SIDEBAR_ITEM_IDLE} ${
                    item.muted && !item.active ? 'text-slate-500' : ''
                  }`}
                >
                  <span className="line-clamp-2">{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}

export function HelpCmsArticleReadLayout({
  sidebarItems,
  articleItems = [],
  articlesLoading = false,
  showArticleSidebar = false,
  mobileSectionLabel,
  mobileArticleTitle = null,
  activeSectionSlug = null,
  activeArticleSlug = null,
  activeSectionArticles = [],
  children,
}: Props) {
  const usePublicToc = sidebarItems.some((c) => Boolean(c.slug || c.href));
  const sectionLabel =
    mobileSectionLabel?.trim() ||
    sidebarItems.find((c) => c.active)?.label ||
    '분류';

  return (
    <div className={HELP_CMS_BROWSE_ROW}>
      {usePublicToc ? (
        <HelpCmsMobileNavBar
          sectionLabel={sectionLabel}
          articleTitle={mobileArticleTitle}
          sidebarItems={sidebarItems}
          articleItems={articleItems}
          articlesLoading={articlesLoading}
        />
      ) : null}

      {usePublicToc ? (
        <HelpCmsPcTocTree
          categories={sidebarItems}
          activeSectionSlug={activeSectionSlug}
          activeArticleSlug={activeArticleSlug}
          activeSectionArticles={activeSectionArticles}
          activeSectionArticlesLoading={articlesLoading}
        />
      ) : (
        <EditorSidebar
          sidebarItems={sidebarItems}
          articleItems={articleItems}
          articlesLoading={articlesLoading}
          showArticleSidebar={showArticleSidebar}
        />
      )}

      <main className={HELP_CMS_MAIN_COLUMN}>{children}</main>
    </div>
  );
}

export function HelpCmsArticleCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${HELP_CMS_ARTICLE_CARD} ${className}`.trim()}>{children}</div>;
}
