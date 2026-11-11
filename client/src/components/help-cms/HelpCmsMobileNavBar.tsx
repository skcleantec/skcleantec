import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { HelpCmsSidebarArticleItem, HelpCmsSidebarItem } from './helpCmsArticleLayout';
import { helpUsageHomePath } from './helpCmsUsagePaths';
import { HelpCategoryIcon } from './HelpCategoryIcon';

type Props = {
  sectionLabel: string;
  articleTitle?: string | null;
  sidebarItems: HelpCmsSidebarItem[];
  articleItems: HelpCmsSidebarArticleItem[];
  articlesLoading?: boolean;
};

/** lg 미만: 접힌 막대 + 분류/글 드롭다운. PC에서는 렌더하지 않음(부모에서 lg:hidden). */
export function HelpCmsMobileNavBar({
  sectionLabel,
  articleTitle,
  sidebarItems,
  articleItems,
  articlesLoading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(56);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const location = useLocation();

  /** 글·분류 URL이 바뀌면 항상 접기 */
  useEffect(() => {
    setOpen(false);
  }, [location.search, location.pathname]);

  useEffect(() => {
    const header = document.getElementById('help-app-header');
    if (!header) return;
    const apply = () => setHeaderOffset(Math.ceil(header.getBoundingClientRect().height));
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(header);
    window.addEventListener('resize', apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const t = e.target;
      if (t instanceof Node && !el.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div
      ref={rootRef}
      className="sticky z-20 border-b border-slate-200 bg-white lg:hidden"
      style={{ top: headerOffset }}
    >
      <div className="flex h-12 items-center gap-1 px-2">
        <Link
          to={helpUsageHomePath()}
          className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#0284c7] hover:bg-sky-50"
          onClick={close}
        >
          ← 홈
        </Link>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[13px] font-semibold text-slate-900">{sectionLabel}</p>
          {articleTitle ? (
            <p className="truncate text-[11px] leading-tight text-slate-500">{articleTitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '분류 ▴' : '분류 ▾'}
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          className="max-h-[70vh] overflow-y-auto overscroll-contain border-t border-slate-100 bg-white px-2 py-2 shadow-md"
          role="navigation"
          aria-label="분류·글"
        >
          <ul className="space-y-0.5">
            {sidebarItems.map((cat) => {
              const isActive = Boolean(cat.active);
              return (
                <li key={cat.id}>
                  {cat.href ? (
                    <Link
                      to={cat.href}
                      onClick={close}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[14px] ${
                        isActive
                          ? 'bg-sky-50 font-bold text-[#0284c7]'
                          : 'font-medium text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <HelpCategoryIcon slug={cat.slug} size={20} />
                        <span className="truncate">{cat.label}</span>
                      </span>
                      {cat.count != null ? (
                        <span className="shrink-0 tabular-nums text-[12px] text-slate-400">{cat.count}</span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className="flex px-3 py-2 text-[14px] text-slate-800">{cat.label}</span>
                  )}
                  {isActive ? (
                    <ul className="mb-1 ml-3 border-l border-sky-100 pl-2">
                      {articlesLoading ? (
                        <li className="px-2 py-1.5 text-[12px] text-slate-400">불러오는 중…</li>
                      ) : articleItems.length === 0 ? (
                        <li className="px-2 py-1.5 text-[12px] text-slate-400">글 없음</li>
                      ) : (
                        articleItems.map((row) =>
                          row.href ? (
                            <li key={row.id}>
                              <Link
                                to={row.href}
                                onClick={close}
                                className={`block truncate rounded-md px-2 py-1.5 text-[13px] ${
                                  row.active
                                    ? 'font-semibold text-[#0284c7]'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                {row.title}
                              </Link>
                            </li>
                          ) : (
                            <li key={row.id} className="px-2 py-1.5 text-[13px] text-slate-600">
                              {row.title}
                            </li>
                          ),
                        )
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
