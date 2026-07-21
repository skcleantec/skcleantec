import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlatformPromoActiveItem } from '../../api/platformPartnerPromo';
import { platformPromoBannerImageUrl, platformPromoHasBannerImage } from '@shared/platformPromoImageSpec';

const ROTATE_MS = 4500;
const SLIDE_MS = 680;

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PromoSlide({
  item,
  imageUrl,
  className = '',
  edgeToEdge = false,
}: {
  item: PlatformPromoActiveItem;
  imageUrl: string;
  className?: string;
  edgeToEdge?: boolean;
}) {
  const frameClass = edgeToEdge
    ? 'block h-full w-full overflow-hidden'
    : 'block h-full w-full overflow-hidden rounded-xl ring-1 ring-slate-200/80';

  const img = (
    <img
      src={imageUrl}
      alt=""
      className={`block h-full w-full object-cover ${className}`}
      loading="lazy"
      decoding="async"
    />
  );

  if (item.linkUrl) {
    return (
      <a
        href={item.linkUrl}
        target={item.linkTarget === '_self' ? '_self' : '_blank'}
        rel="noopener noreferrer"
        className={frameClass}
      >
        {img}
      </a>
    );
  }

  return <div className={frameClass}>{img}</div>;
}

function PlatformPromoSlider({
  slides,
  frameClass,
}: {
  slides: PlatformPromoActiveItem[];
  frameClass: string;
}) {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || reduceMotion || isPaused) return;
    const timer = window.setInterval(goNext, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, reduceMotion, isPaused, goNext, index]);

  if (slides.length === 0) return null;

  const slideTransition = reduceMotion
    ? ''
    : `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

  return (
    <div
      className="w-full min-w-0"
      role="region"
      aria-roledescription="carousel"
      aria-label="청소비서 안내"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsPaused(false);
      }}
    >
      <div className={frameClass}>
        <div
          className="flex h-full w-full will-change-transform"
          style={{
            transform: `translate3d(-${index * 100}%, 0, 0)`,
            transition: slideTransition,
          }}
        >
          {slides.map((item) => (
            <div key={item.id} className="h-full w-full shrink-0">
              <PromoSlide
                item={item}
                imageUrl={platformPromoBannerImageUrl(item)}
                edgeToEdge
              />
            </div>
          ))}
        </div>

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="이전 배너"
              className="absolute left-1 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white/45 text-slate-700/85 opacity-75 transition duration-200 hover:bg-white/70 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/70 sm:left-1.5 sm:h-6 sm:w-6"
              onClick={(e) => {
                e.preventDefault();
                goPrev();
              }}
            >
              <ChevronLeftIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
            <button
              type="button"
              aria-label="다음 배너"
              className="absolute right-1 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white/45 text-slate-700/85 opacity-75 transition duration-200 hover:bg-white/70 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/70 sm:right-1.5 sm:h-6 sm:w-6"
              onClick={(e) => {
                e.preventDefault();
                goNext();
              }}
            >
              <ChevronRightIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
            <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`${i + 1}번째 배너`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`rounded-full transition-all duration-300 ${
                    i === index ? 'h-1.5 w-4 bg-white shadow-sm' : 'h-1.5 w-1.5 bg-white/50 hover:bg-white/70'
                  }`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** 모바일 상단 롤링 배너 (5:2) */
export function PlatformPromoCarousel({ items }: { items: PlatformPromoActiveItem[] }) {
  const slides = useMemo(
    () => items.filter((item) => item.showOnMobile && platformPromoHasBannerImage(item)),
    [items],
  );

  return (
    <PlatformPromoSlider
      slides={slides}
      frameClass="relative aspect-[5/2] w-full min-w-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80"
    />
  );
}

/** PC 대시보드 프로모 — square: 레거시, banner: 5:2 가로형(테넌트 사이드·타업체 PC 공통) */
export function PlatformPromoDashboardCard({
  items,
  layout = 'banner',
}: {
  items: PlatformPromoActiveItem[];
  layout?: 'square' | 'banner';
}) {
  const slides = useMemo(
    () => items.filter((item) => item.showOnDesktop && platformPromoHasBannerImage(item)),
    [items],
  );

  const frameClass =
    layout === 'banner'
      ? 'relative aspect-[5/2] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200/80'
      : 'relative aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200/80';

  return <PlatformPromoSlider slides={slides} frameClass={frameClass} />;
}
