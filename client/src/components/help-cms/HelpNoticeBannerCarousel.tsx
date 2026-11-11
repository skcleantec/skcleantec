import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HELP_CATEGORY_ART,
  HELP_NOTICE_BANNER_DEFAULT_TINT,
  HELP_NOTICE_BANNER_TINT,
  splitNoticeBannerTitle,
} from '@shared/helpHomeConfig';
import { fetchPublicCustomerBoardPosts } from '../../api/publicCustomerBoard';
import type { PlatformBoardPost } from '../../api/platformCustomerBoard';
import { Button } from '../ui/Button';

const AUTOPLAY_MS = 5000;
const NEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

function noticePath(id: string): string {
  return `/help?category=notice&post=${encodeURIComponent(id)}`;
}

function isNew(post: PlatformBoardPost): boolean {
  const at = Date.parse(post.publishedAt ?? post.createdAt);
  return Number.isFinite(at) && Date.now() - at < NEW_WITHIN_MS;
}

function Chips({ label, ink, fresh }: { label: string; ink: string; fresh: boolean }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className="rounded-full bg-white px-2.5 py-0.5 text-fluid-2xs font-bold" style={{ color: ink }}>
        {label}
      </span>
      {fresh ? (
        <span className="rounded-full bg-[#e11d48] px-2 py-0.5 text-fluid-2xs font-bold text-white">NEW</span>
      ) : null}
    </span>
  );
}

function Thumb({ url, size }: { url: string | null | undefined; size: 'pc' | 'mobile' }) {
  const box = size === 'pc' ? 'h-[136px] w-[136px] rounded-2xl' : 'h-[84px] w-[84px] rounded-xl';
  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className={`${box} block shrink-0 object-cover ${size === 'pc' ? 'shadow-[0_6px_16px_rgba(15,23,42,0.12)]' : ''}`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center`}>
      <span
        className={`flex items-center justify-center rounded-full bg-white ${
          size === 'pc' ? 'h-[120px] w-[120px]' : 'h-[76px] w-[76px]'
        }`}
      >
        <img
          src={HELP_CATEGORY_ART.start?.icon}
          alt=""
          className={size === 'pc' ? 'h-24 w-24' : 'h-14 w-14'}
        />
      </span>
    </span>
  );
}

/** 배너 한 장 — 휴대폰(위: 칩·제목 / 썸네일, 아래: 설명) · 태블릿·PC(왼쪽 글 / 오른쪽 썸네일) */
function BannerSlide({ post, index, total }: { post: PlatformBoardPost; index: number; total: number }) {
  const label = post.categoryLabel?.trim() || '사용 방법';
  const tint = HELP_NOTICE_BANNER_TINT[label] ?? HELP_NOTICE_BANNER_DEFAULT_TINT;
  const { head, sub } = splitNoticeBannerTitle(post.title, post.excerpt);
  const fresh = isNew(post);
  return (
    <Link
      to={noticePath(post.id)}
      aria-roledescription="slide"
      aria-label={`${index + 1} / ${total}`}
      data-slide-index={index}
      className="w-[calc(100vw-72px)] max-w-[420px] shrink-0 snap-start overflow-hidden rounded-2xl text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:w-[78%] sm:max-w-none lg:w-[calc((100%-14px)/2)]"
      style={{ backgroundColor: tint.bg }}
    >
      {/* 휴대폰 */}
      <span className="flex flex-col gap-2.5 p-4 sm:hidden">
        <span className="flex items-start justify-between gap-2.5">
          <span className="flex min-w-0 flex-col gap-1.5">
            <Chips label={label} ink={tint.ink} fresh={fresh} />
            <span className="line-clamp-2 text-fluid-lg font-extrabold leading-snug">{head}</span>
          </span>
          <Thumb url={post.thumbnailUrl} size="mobile" />
        </span>
        {sub ? <span className="line-clamp-2 text-fluid-sm leading-normal text-slate-700">{sub}</span> : null}
        <span className="text-fluid-xs font-bold" style={{ color: tint.ink }}>
          자세히 보기 →
        </span>
      </span>
      {/* 태블릿·PC */}
      <span className="hidden h-[180px] items-center gap-[18px] py-[22px] pl-7 pr-[22px] sm:flex">
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <Chips label={label} ink={tint.ink} fresh={fresh} />
          <span className="line-clamp-2 text-fluid-lg font-extrabold leading-snug">{head}</span>
          {sub ? <span className="line-clamp-2 text-fluid-sm leading-normal text-slate-700">{sub}</span> : null}
          <span className="text-fluid-xs font-bold" style={{ color: tint.ink }}>
            자세히 보기 →
          </span>
        </span>
        <Thumb url={post.thumbnailUrl} size="pc" />
      </span>
    </Link>
  );
}

/** 스크롤 위치 ↔ 현재 장, 자동 넘김(멈춤 조건 포함) */
function useBannerCarousel(count: number) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  const slides = useCallback(
    () => Array.from(scrollerRef.current?.querySelectorAll<HTMLElement>('[data-slide-index]') ?? []),
    [],
  );

  const atEnd = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return false;
    return el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const el = scrollerRef.current;
      const list = slides();
      if (!el || list.length === 0) return;
      const target = list[((i % list.length) + list.length) % list.length]!;
      const first = list[0]!;
      el.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
    },
    [slides, reduced],
  );

  const next = useCallback(() => {
    if (atEnd() || index >= count - 1) goTo(0);
    else goTo(index + 1);
  }, [atEnd, goTo, index, count]);

  const prev = useCallback(() => {
    if (index <= 0) goTo(count - 1);
    else goTo(index - 1);
  }, [goTo, index, count]);

  // 스크롤하면 가장 가까운 장을 현재 장으로
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const list = slides();
        if (list.length === 0) return;
        const base = list[0]!.offsetLeft;
        let best = 0;
        let bestDist = Infinity;
        list.forEach((s, i) => {
          const d = Math.abs(s.offsetLeft - base - el.scrollLeft);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setIndex(best);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [slides, count]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0.3,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [count]);

  useEffect(() => {
    if (count < 2 || paused || !visible || reduced) return;
    const t = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [count, paused, visible, reduced, next]);

  return { scrollerRef, sectionRef, index, goTo, next, prev, setPaused };
}

/** /help 첫 화면 「새 기능·공지」 — 쇼핑몰식 배너 */
export function HelpNoticeBannerCarousel({ onGoNotice }: { onGoNotice: () => void }) {
  const [posts, setPosts] = useState<PlatformBoardPost[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCustomerBoardPosts({ boardSlug: 'notice', limit: 6, offset: 0 })
      .then((r) => {
        if (!cancelled) setPosts(r.items);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = posts.length;
  const { scrollerRef, sectionRef, index, goTo, next, prev, setPaused } = useBannerCarousel(total);
  const touchTimer = useRef<number | undefined>(undefined);

  if (total === 0) return null;

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label="새 기능·공지"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onTouchStart={() => {
        window.clearTimeout(touchTimer.current);
        setPaused(true);
      }}
      onTouchEnd={() => {
        touchTimer.current = window.setTimeout(() => setPaused(false), AUTOPLAY_MS);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          next();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prev();
        }
      }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3 lg:mb-3">
        <h3 className="text-fluid-base font-bold text-slate-900">새 기능·공지</h3>
        <div className="flex items-center gap-2">
          <span className="hidden text-fluid-xs tabular-nums text-slate-500 lg:inline">
            {index + 1} / {total}
          </span>
          <span className="hidden gap-2 lg:flex">
            {(['prev', 'next'] as const).map((dir) => (
              <Button
                key={dir}
                variant="secondary"
                icon
                aria-label={dir === 'prev' ? '이전 배너' : '다음 배너'}
                onClick={dir === 'prev' ? prev : next}
                className="rounded-full border-transparent text-fluid-base shadow-[0_1px_3px_rgba(15,23,42,0.12)]"
              >
                {dir === 'prev' ? '‹' : '›'}
              </Button>
            ))}
          </span>
          <a
            href="/help?category=notice"
            onClick={(e) => {
              e.preventDefault();
              onGoNotice();
            }}
            className="text-fluid-sm font-bold text-sky-700 hover:underline lg:ml-1.5"
          >
            전체 보기 →
          </a>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:gap-3.5 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post, i) => (
          <BannerSlide key={post.id} post={post} index={i} total={total} />
        ))}
      </div>

      {total > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {posts.map((post, i) => (
            <button
              key={post.id}
              type="button"
              tabIndex={-1}
              aria-label={`${i + 1}번째 배너로`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-slate-900' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
