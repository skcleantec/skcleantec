import { useEffect } from 'react';

type PublicSeoMeta = {
  title?: string | null;
  description?: string | null;
  robots?: 'index,follow' | 'noindex,nofollow';
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** 공개 /help 글 — 탭 제목·검색 메타. 로그인 화면 기본 noindex를 덮어쓴다. */
export function usePublicSeoMeta(meta: PublicSeoMeta): void {
  const title = meta.title?.trim() || '';
  const description = meta.description?.trim() || '';
  const robots = meta.robots;

  useEffect(() => {
    if (title && document.title !== title) document.title = title;
    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:title', title || document.title);
      upsertMeta('property', 'og:description', description);
    }
    if (robots) upsertMeta('name', 'robots', robots);
  }, [title, description, robots]);
}
