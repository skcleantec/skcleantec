import { useEffect, useMemo, useState } from 'react';
import type { PlatformPromoActiveItem } from '../../api/platformPartnerPromo';

const ROTATE_MS = 4500;

function PromoSlide({
  item,
  imageUrl,
  className = '',
}: {
  item: PlatformPromoActiveItem;
  imageUrl: string;
  className?: string;
}) {
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
        className="block h-full w-full overflow-hidden rounded-xl ring-1 ring-slate-200/80"
      >
        {img}
      </a>
    );
  }
  return <div className="h-full w-full overflow-hidden rounded-xl ring-1 ring-slate-200/80">{img}</div>;
}

/** 모바일 상단 롤링 배너 (약 2.5:1) */
export function PlatformPromoCarousel({ items }: { items: PlatformPromoActiveItem[] }) {
  const slides = useMemo(
    () => items.filter((item) => item.showOnMobile && item.mobileImageUrl.trim()),
    [items],
  );
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || reduceMotion) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, reduceMotion]);

  if (slides.length === 0) return null;

  const current = slides[index]!;

  return (
    <div className="w-full min-w-0" role="region" aria-label="청소비서 안내">
      <div className="relative aspect-[5/2] w-full min-w-0 overflow-hidden rounded-xl bg-slate-100">
        <PromoSlide item={current} imageUrl={current.mobileImageUrl} />
        {slides.length > 1 ? (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`${i + 1}번째 배너`}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  i === index ? 'bg-white shadow' : 'bg-white/50'
                }`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
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
    () => items.filter((item) => item.showOnDesktop && item.desktopImageUrl.trim()),
    [items],
  );
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || reduceMotion) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, reduceMotion]);

  if (slides.length === 0) return null;

  const current = slides[index]!;

  const frameClass =
    layout === 'banner'
      ? 'relative aspect-[5/2] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200/80'
      : 'relative aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200/80';

  return (
    <div className="w-full min-w-0" role="region" aria-label="청소비서 안내">
      <div className={frameClass}>
        <PromoSlide item={current} imageUrl={current.desktopImageUrl} className="object-cover" />
        {slides.length > 1 ? (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`${i + 1}번째 배너`}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white shadow' : 'bg-white/60'}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
