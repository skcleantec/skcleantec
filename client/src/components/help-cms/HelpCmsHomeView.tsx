import { useEffect, useMemo, useState } from 'react';
import type { HelpCmsArticleListItem, HelpCmsCategory } from '../../api/platformHelpCms';
import { fetchPublicCustomerBoardPosts } from '../../api/publicCustomerBoard';
import type { PlatformBoardPost } from '../../api/platformCustomerBoard';
import {
  HELP_HOME_AUDIENCE,
  HELP_HOME_CONTACT,
  HELP_HOME_FAQ_ARTICLE,
  HELP_HOME_HERO,
  HELP_HOME_POPULAR_ARTICLES,
  HELP_HOME_TROUBLE_ARTICLES,
} from '@shared/helpHomeConfig';
import { HelpCmsArticleCard } from './HelpCmsArticleReadLayout';

const AUDIENCE_ORDER_CLASS: Record<string, string> = {
  newcomer: 'order-2 sm:order-1',
  admin: 'order-3 sm:order-2',
  team: 'order-1 sm:order-3',
};

type Props = {
  categories: HelpCmsCategory[];
  articlesBySlug: Record<string, HelpCmsArticleListItem[]>;
  loadingArticles: boolean;
  onSearch: (q: string) => void;
  onOpenArticle: (section: string, article: string) => void;
  onOpenSection: (section: string) => void;
  onScrollToCategories: () => void;
  onGoInquiry: () => void;
  onGoNotice: () => void;
};

export function HelpCmsHomeView({
  categories,
  articlesBySlug,
  loadingArticles,
  onSearch,
  onOpenArticle,
  onOpenSection,
  onScrollToCategories,
  onGoInquiry,
  onGoNotice,
}: Props) {
  const [q, setQ] = useState('');
  const [notices, setNotices] = useState<PlatformBoardPost[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCustomerBoardPosts({ boardSlug: 'notice', limit: 2, offset: 0 })
      .then((r) => {
        if (!cancelled) setNotices(r.items);
      })
      .catch(() => {
        if (!cancelled) setNotices([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const popularRows = useMemo(() => {
    const flat = Object.values(articlesBySlug).flat();
    return HELP_HOME_POPULAR_ARTICLES.map((cfg) => {
      const hit = flat.find((a) => a.slug === cfg.slug);
      return { ...cfg, title: hit?.title ?? cfg.slug, excerpt: hit?.excerpt ?? null };
    });
  }, [articlesBySlug]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-[#0f172a] px-5 py-8 text-white shadow-lg sm:px-8">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{HELP_HOME_HERO.title}</h2>
        <p className="mt-2 max-w-2xl text-fluid-sm text-slate-300">{HELP_HOME_HERO.subtitle}</p>
        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(q.trim());
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={HELP_HOME_HERO.searchPlaceholder}
            className="min-w-0 flex-1 rounded-xl border-0 bg-white px-4 py-3 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-600 px-5 py-3 text-fluid-sm font-semibold text-white hover:bg-sky-500"
          >
            검색
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-fluid-2xs text-slate-400">많이 찾는 말</span>
          {HELP_HOME_HERO.popularChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onSearch(chip)}
              className="rounded-full bg-white/10 px-3 py-1 text-fluid-2xs font-medium text-white hover:bg-white/20"
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-fluid-sm font-semibold text-slate-500">누구세요?</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HELP_HOME_AUDIENCE.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (card.kind === 'article' && 'articleSlug' in card && 'sectionSlug' in card) {
                  onOpenArticle(card.sectionSlug, card.articleSlug);
                } else if (card.kind === 'section' && 'sectionSlug' in card) {
                  onOpenSection(card.sectionSlug);
                } else {
                  onScrollToCategories();
                }
              }}
              className={`${AUDIENCE_ORDER_CLASS[card.id] ?? ''} rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${
                card.tone === 'green'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p
                className={`text-fluid-sm font-bold ${
                  card.tone === 'green' ? 'text-[#047857]' : 'text-slate-900'
                }`}
              >
                {card.title}
              </p>
              <p className="mt-2 text-fluid-sm font-semibold text-sky-700">{card.cta} →</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-fluid-sm font-semibold text-slate-500">자주 찾는 글</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {popularRows.map((row) => (
            <button
              key={row.slug}
              type="button"
              onClick={() => onOpenArticle(row.section, row.slug)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-sky-200 hover:shadow-md"
            >
              <p className="font-semibold text-slate-900">{row.title}</p>
              {row.excerpt ? (
                <p className="mt-1 line-clamp-2 text-fluid-2xs text-slate-600">{row.excerpt}</p>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section id="help-home-categories">
        <h3 className="mb-3 text-fluid-sm font-semibold text-slate-500">하고 싶은 일로 찾기</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onOpenSection(cat.slug)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-sky-200"
            >
              <p className="font-bold text-slate-900">{cat.label}</p>
              {cat.description ? (
                <p className="mt-1 line-clamp-2 text-fluid-2xs text-slate-600">{cat.description}</p>
              ) : null}
              <p className="mt-2 text-fluid-2xs font-medium text-amber-700">
                <span className="rounded-full bg-[#fffbeb] px-2 py-0.5 text-[#b45309]">
                  글 {cat.articleCount}개
                </span>
              </p>
            </button>
          ))}
        </div>
        {loadingArticles ? (
          <p className="mt-2 text-fluid-2xs text-slate-400">글 목록 불러오는 중…</p>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HelpCmsArticleCard>
          <h3 className="font-bold text-slate-900">자주 묻는 질문</h3>
          <ul className="mt-3 space-y-2">
            {HELP_HOME_FAQ_ARTICLE.prompts.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  onClick={() =>
                    onOpenArticle(HELP_HOME_FAQ_ARTICLE.section, HELP_HOME_FAQ_ARTICLE.slug)
                  }
                  className="text-left text-fluid-sm text-sky-700 hover:underline"
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </HelpCmsArticleCard>
        <HelpCmsArticleCard>
          <h3 className="font-bold text-slate-900">이럴 땐 여기부터</h3>
          <ul className="mt-3 space-y-2">
            {HELP_HOME_TROUBLE_ARTICLES.map((row) => (
              <li key={row.slug}>
                <button
                  type="button"
                  onClick={() => onOpenArticle(row.section, row.slug)}
                  className="text-left text-fluid-sm text-sky-700 hover:underline"
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        </HelpCmsArticleCard>
      </section>

      <section className="rounded-2xl bg-[#0f172a] px-5 py-6 text-white sm:px-8">
        <h3 className="text-lg font-bold">{HELP_HOME_CONTACT.title}</h3>
        <p className="mt-1 text-fluid-sm text-slate-300">{HELP_HOME_CONTACT.hours}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href={HELP_HOME_CONTACT.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-[#fee500] px-4 py-2.5 text-fluid-sm font-bold text-slate-900"
          >
            {HELP_HOME_CONTACT.kakaoLabel}
          </a>
          <button
            type="button"
            onClick={onGoInquiry}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-fluid-sm font-semibold text-slate-900"
          >
            1:1 문의 남기기
          </button>
          <a
            href={HELP_HOME_CONTACT.phoneTel}
            className="inline-flex items-center justify-center rounded-xl border border-white/30 px-4 py-2.5 text-fluid-sm font-semibold text-white"
          >
            전화 {HELP_HOME_CONTACT.phone}
          </a>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-fluid-sm font-semibold text-slate-500">새 기능·공지</h3>
          <button
            type="button"
            onClick={onGoNotice}
            className="text-fluid-2xs font-semibold text-sky-700 hover:underline"
          >
            전체 보기
          </button>
        </div>
        <div className="space-y-2">
          {notices.length === 0 ? (
            <p className="text-fluid-sm text-slate-500">등록된 공지가 없습니다.</p>
          ) : (
            notices.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={onGoNotice}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
              >
                {n.thumbnailUrl ? (
                  <img
                    src={n.thumbnailUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16"
                  />
                ) : (
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-fluid-sm font-bold text-slate-500 sm:h-16 sm:w-16">
                    N
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-semibold text-slate-900">{n.title}</span>
                  {n.excerpt ? (
                    <span className="mt-0.5 line-clamp-1 block text-fluid-2xs text-slate-600">
                      {n.excerpt}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

    </div>
  );
}
