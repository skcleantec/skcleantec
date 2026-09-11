/** 메뉴·다른 화면으로 갈 때 최신 index.html을 받도록 경로가 바뀌면 풀 이동한다. */

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function shouldHardNavigateOnMenuClick(
  anchor: HTMLAnchorElement,
  event: MouseEvent,
  current: Pick<Location, 'origin' | 'pathname'> = window.location,
): boolean {
  if (event.defaultPrevented) return false;
  if (isModifiedClick(event)) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (anchor.dataset.softNav === 'true') return false;
  const raw = anchor.getAttribute('href');
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return false;
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return false;
  }
  if (url.origin !== current.origin) return false;
  if (url.pathname.startsWith('/assets/')) return false;
  return url.pathname !== current.pathname;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (!shouldHardNavigateOnMenuClick(anchor, event)) return;
  event.preventDefault();
  window.location.assign(`${anchor.pathname}${anchor.search}${anchor.hash}`);
}

export function installHardNavigateOnMenuChange(): void {
  document.addEventListener('click', onDocumentClick, true);
}
