/** Paged.js 출력 안에 갑·을 부록이 실제로 배치됐는지 확인할 때 사용하는 마커 */
export function contractHtmlExpectsPartyAppendix(doc: Document): boolean {
  return (doc.body?.innerHTML ?? '').includes('ec-party-appendix');
}

/**
 * `.pagedjs_pages` 안에 페이지가 생기고, 부록이 있는 계약이면 부록 DOM이 붙어 높이가 나올 때까지 대기합니다.
 * (postMessage 시점·8초 폴백보다 늦게 부록이 페이지에 들어오는 경우 1차 PDF가 비는 문제 방지)
 */
export async function waitUntilPagedDomPainted(doc: Document, timeoutMs = 18000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pages = doc.querySelectorAll('.pagedjs_pages .pagedjs_page');
    if (pages.length === 0) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    if (!contractHtmlExpectsPartyAppendix(doc)) return;

    const ap = doc.querySelector('.pagedjs_pages .ec-party-appendix');
    const h = ap?.getBoundingClientRect().height ?? 0;
    if (ap && h >= 16) return;

    await new Promise((r) => setTimeout(r, 50));
  }
}

/** PDF 래스터화 직전 — 폰트·이미지 로드 후 한두 프레임 안정화 */
export async function settleIframeForRasterCapture(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return;

  try {
    await Promise.race([doc.fonts.ready, new Promise<void>((r) => setTimeout(r, 3000))]);
  } catch {
    /* ignore */
  }

  const imgs = [...doc.querySelectorAll('img')];
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete && img.naturalHeight !== 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
              setTimeout(resolve, 12000);
            })
    )
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
