import { useEffect } from 'react';

const QUOTE_MANIFEST = '/m/quote.webmanifest';
const DEFAULT_MANIFEST = '/manifest.webmanifest';

function ensureMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    el.dataset.quotePwa = '1';
    document.head.appendChild(el);
  }
  el.content = content;
}

/** 견적 화면에서만 홈 화면 추가용 매니페스트·상태바를 켠다. 떠나면 원래대로. */
export function useQuotePwaHead() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevHref = link?.getAttribute('href') ?? DEFAULT_MANIFEST;
    if (link) link.href = QUOTE_MANIFEST;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = theme?.content ?? '#121828';
    if (theme) theme.content = '#F1F4F9';
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'default');
    ensureMeta('apple-mobile-web-app-title', '견적');
    const prevTitle = document.title;
    document.title = '청소비서 견적';
    return () => {
      if (link) link.href = prevHref;
      if (theme) theme.content = prevTheme;
      document.querySelectorAll('[data-quote-pwa="1"]').forEach((el) => el.remove());
      document.title = prevTitle;
    };
  }, []);
}
