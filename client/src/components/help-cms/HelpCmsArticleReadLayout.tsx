import type { ReactNode } from 'react';
import {
  HELP_CMS_ARTICLE_CARD,
  HELP_CMS_BROWSE_ROW,
  HELP_CMS_MAIN_COLUMN,
  HELP_CMS_SIDEBAR_ASIDE,
  HELP_CMS_SIDEBAR_ITEM_ACTIVE,
  HELP_CMS_SIDEBAR_ITEM_IDLE,
  HELP_CMS_SIDEBAR_LABEL,
} from './helpCmsArticleLayout';

export type HelpCmsSidebarItem = {
  id: string;
  label: string;
  count?: number;
  active?: boolean;
  onSelect?: () => void;
};

export type HelpCmsSidebarArticleItem = {
  id: string;
  title: string;
  active?: boolean;
  muted?: boolean;
  onSelect?: () => void;
};

type Props = {
  sidebarLabel?: string;
  sidebarItems: HelpCmsSidebarItem[];
  articleSidebarLabel?: string;
  articleItems?: HelpCmsSidebarArticleItem[];
  articlesLoading?: boolean;
  showArticleSidebar?: boolean;
  children: ReactNode;
};

export function HelpCmsArticleReadLayout({
  sidebarLabel = '카테고리',
  sidebarItems,
  articleSidebarLabel = '글',
  articleItems = [],
  articlesLoading = false,
  showArticleSidebar = false,
  children,
}: Props) {
  const renderSidebarButton = (
    item: HelpCmsSidebarItem | HelpCmsSidebarArticleItem,
    label: string,
    countEl: ReactNode,
    idleHover: string,
  ) => {
    const className = item.active ? HELP_CMS_SIDEBAR_ITEM_ACTIVE : HELP_CMS_SIDEBAR_ITEM_IDLE;
    const muted = 'muted' in item && item.muted;

    if (item.onSelect) {
      return (
        <button
          key={item.id}
          type="button"
          onClick={item.onSelect}
          title={label}
          className={`transition-colors ${className} ${item.active ? '' : idleHover} ${
            muted && !item.active ? 'text-slate-500' : ''
          }`}
        >
          <span className="line-clamp-2">{label}</span>
          {countEl}
        </button>
      );
    }

    return (
      <div key={item.id} className={`${className} ${muted ? 'text-slate-500' : ''}`}>
        <span className="line-clamp-2">{label}</span>
        {countEl}
      </div>
    );
  };

  return (
    <div className={HELP_CMS_BROWSE_ROW}>
      <aside
        className={`${HELP_CMS_SIDEBAR_ASIDE} lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:overscroll-y-contain`}
      >
        <p className={HELP_CMS_SIDEBAR_LABEL}>{sidebarLabel}</p>
        {sidebarItems.map((item) => {
          const countEl =
            item.count != null ? (
              <span className={`ml-1 tabular-nums ${item.active ? 'text-slate-300' : 'text-slate-400'}`}>
                {item.count}
              </span>
            ) : null;
          return renderSidebarButton(item, item.label, countEl, 'hover:bg-slate-50');
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
                  renderSidebarButton(item, item.title, null, 'hover:bg-slate-50'),
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
