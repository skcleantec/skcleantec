import { useEffect, useRef } from 'react';

type Props = {
  html: string;
  className?: string;
};

/** 완성 HTML 공지 — 목차 이동·FAQ 접기·캡처 자리 숨김 */
export function HelpCmsDesignedArticleView({ html, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const live = /(^|\.)cbiseo\.com$/.test(window.location.hostname);
    const onImgError = (event: Event) => {
      const img = event.currentTarget as HTMLImageElement;
      const fig = img.closest('.shot');
      if (!(fig instanceof HTMLElement)) return;
      if (live) fig.hidden = true;
      else fig.classList.add('empty');
    };

    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img.capture'));
    imgs.forEach((img) => {
      img.addEventListener('error', onImgError);
      if (img.complete && img.naturalWidth === 0) {
        onImgError({ currentTarget: img } as unknown as Event);
      }
    });

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('#') || href === '#') return;
      const id = decodeURIComponent(href.slice(1));
      if (!id) return;
      const dest = root.querySelector(`#${CSS.escape(id)}`);
      if (!dest) return;
      event.preventDefault();
      dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    root.addEventListener('click', onClick);

    return () => {
      imgs.forEach((img) => img.removeEventListener('error', onImgError));
      root.removeEventListener('click', onClick);
    };
  }, [html]);

  return <div ref={rootRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
