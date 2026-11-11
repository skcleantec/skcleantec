import { useMemo, useState } from 'react';
import type { HelpCmsArticleListItem, HelpCmsCategory } from '../../api/platformHelpCms';
import {
  HELP_ART,
  HELP_HOME_AUDIENCE,
  HELP_HOME_FAQ_ARTICLE,
  HELP_HOME_HERO,
  HELP_HOME_POPULAR_ARTICLES,
  HELP_HOME_TROUBLE_ARTICLES,
} from '@shared/helpHomeConfig';
import { HelpCategoryIcon } from './HelpCategoryIcon';
import { HelpNoticeBannerCarousel } from './HelpNoticeBannerCarousel';
import { HelpContactBand } from './HelpContactBand';

const AUDIENCE_ORDER_CLASS: Record<string, string> = {
  newcomer: 'order-2 lg:order-1',
  admin: 'order-3 lg:order-2',
  team: 'order-1 lg:order-3',
};

const CARD = 'rounded-2xl bg-white shadow-card';
const SECTION_TITLE = 'mb-3 text-fluid-base font-bold text-slate-900';

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
  const popularRows = useMemo(() => {
    const flat = Object.values(articlesBySlug).flat();
    return HELP_HOME_POPULAR_ARTICLES.map((cfg) => {
      const hit = flat.find((a) => a.slug === cfg.slug);
      return { ...cfg, title: hit?.title ?? cfg.slug, excerpt: hit?.excerpt ?? null };
    });
  }, [articlesBySlug]);

  return (
    <div className="space-y-[26px] lg:space-y-9">
      <section className="relative overflow-hidden rounded-2xl bg-[#0f172a] text-white lg:flex lg:min-h-[400px] lg:items-center">
        <picture>
          <source media="(min-width: 1024px)" srcSet={HELP_ART.heroPhoto} width={2400} height={1018} />
          <img
            src={HELP_ART.heroPhotoMobile}
            alt=""
            aria-hidden="true"
            width={1000}
            height={800}
            loading="eager"
            // @ts-expect-error React 18 은 fetchpriority 소문자 속성을 그대로 넘긴다
            fetchpriority="high"
            className="block h-[190px] w-full object-cover lg:absolute lg:inset-0 lg:h-full lg:object-[75%_50%]"
          />
        </picture>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[100px] h-[90px] bg-gradient-to-b from-transparent to-[#0f172a] lg:hidden"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden lg:block"
          style={{
            background:
              'linear-gradient(90deg, rgba(15,23,42,.94) 0%, rgba(15,23,42,.82) 40%, rgba(15,23,42,.10) 72%)',
          }}
        />
        <div className="relative -mt-2 px-[18px] pb-[22px] lg:mt-0 lg:w-[520px] lg:max-w-full lg:p-12">
          <p className="mb-2.5 hidden text-fluid-xs font-bold text-[#7dd3fc] lg:block">청소비서 도움말 센터</p>
          <h2 className="text-fluid-xl font-extrabold leading-snug tracking-tight">{HELP_HOME_HERO.title}</h2>
          <p className="mt-1.5 text-fluid-sm leading-relaxed text-slate-300 lg:mt-2.5">{HELP_HOME_HERO.subtitle}</p>
          <form
            role="search"
            className="mt-3.5 flex gap-1.5 rounded-xl bg-white p-1.5 lg:mt-[22px] lg:gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(q.trim());
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={HELP_HOME_HERO.searchPlaceholder}
              aria-label="도움말 검색"
              className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-2 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-sky-600 px-3.5 text-fluid-sm font-bold text-white hover:bg-sky-500 lg:px-5"
            >
              검색
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 lg:mt-3.5">
            <span className="mr-1 hidden text-fluid-2xs text-slate-400 lg:inline">많이 찾는 말</span>
            {HELP_HOME_HERO.popularChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onSearch(chip)}
                className="rounded-full bg-slate-800/85 px-3 py-1 text-fluid-2xs text-slate-200 hover:bg-slate-700"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3 className={SECTION_TITLE}>누구세요?</h3>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-3.5">
          {HELP_HOME_AUDIENCE.map((card) => {
            const green = card.tone === 'green';
            return (
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
                className={`${AUDIENCE_ORDER_CLASS[card.id] ?? ''} flex min-h-[44px] items-center justify-between gap-2 rounded-2xl py-3.5 pl-[18px] pr-2.5 text-left shadow-card lg:py-5 lg:pl-[22px] lg:pr-4 ${
                  green ? 'bg-[#ecfdf5]' : 'bg-white'
                }`}
              >
                <span className="flex min-w-0 flex-col gap-1 lg:gap-1.5">
                  <span className={`text-fluid-base font-bold ${green ? 'text-[#047857]' : 'text-slate-900'}`}>
                    {card.title}
                  </span>
                  <span className="hidden text-fluid-sm text-slate-600 lg:block">{card.desc}</span>
                  <span className={`text-fluid-sm font-bold ${green ? 'text-[#047857]' : 'text-sky-600'}`}>
                    {card.cta} →
                  </span>
                </span>
                <img
                  src={card.art}
                  alt=""
                  aria-hidden="true"
                  className="block h-auto w-[108px] shrink-0 lg:w-[132px]"
                />
              </button>
            );
          })}
        </div>
      </section>

      <HelpNoticeBannerCarousel onGoNotice={onGoNotice} />

      <section>
        <h3 className={SECTION_TITLE}>자주 찾는 글</h3>
        <div className="rounded-2xl bg-white px-1.5 py-1 shadow-card lg:grid lg:grid-cols-2 lg:gap-3 lg:bg-transparent lg:p-0 lg:shadow-none">
          {popularRows.map((row) => (
            <button
              key={row.slug}
              type="button"
              onClick={() => onOpenArticle(row.section, row.slug)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left hover:bg-slate-50 lg:items-start lg:gap-3.5 lg:rounded-2xl lg:bg-white lg:px-[18px] lg:py-4 lg:shadow-card"
            >
              <HelpCategoryIcon slug={row.section} className="h-8 w-8 lg:h-10 lg:w-10" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-fluid-sm font-semibold text-slate-900 lg:font-bold">{row.title}</span>
                {row.excerpt ? (
                  <span className="hidden text-fluid-xs leading-relaxed text-slate-600 lg:line-clamp-2">
                    {row.excerpt}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section id="help-home-categories">
        <h3 className={SECTION_TITLE}>하고 싶은 일로 찾기</h3>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onOpenSection(cat.slug)}
              className={`${CARD} flex flex-col items-start gap-2 p-3.5 text-left hover:bg-slate-50 lg:flex-row lg:items-center lg:gap-3.5 lg:p-[18px]`}
            >
              <HelpCategoryIcon slug={cat.slug} className="h-10 w-10 lg:h-[52px] lg:w-[52px]" />
              <span className="flex min-w-0 flex-col gap-1 lg:flex-1">
                <span className="text-fluid-sm font-bold text-slate-900">{cat.label}</span>
                {cat.description ? (
                  <span className="hidden text-fluid-xs text-slate-600 lg:line-clamp-2">{cat.description}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-fluid-2xs text-slate-500">글 {cat.articleCount}</span>
            </button>
          ))}
        </div>
        {loadingArticles ? (
          <p className="mt-2 text-fluid-2xs text-slate-400">글 목록 불러오는 중…</p>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className={`${CARD} px-[22px] py-5`}>
          <h3 className="mb-2.5 flex items-center gap-2.5 text-fluid-base font-bold text-slate-900">
            <HelpCategoryIcon slug="faq" size={28} />
            자주 묻는 질문
          </h3>
          <ul className="flex flex-col gap-2.5">
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
        </div>
        <div className={`${CARD} px-[22px] py-5`}>
          <h3 className="mb-2.5 flex items-center gap-2.5 text-fluid-base font-bold text-slate-900">
            <HelpCategoryIcon slug="account" size={28} />
            이럴 땐 여기부터
          </h3>
          <ul className="flex flex-col gap-2.5">
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
        </div>
      </section>

      <HelpContactBand onGoInquiry={onGoInquiry} />

    </div>
  );
}
