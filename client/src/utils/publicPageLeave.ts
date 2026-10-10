/**
 * 고객 공개 페이지(발주서·안내 등) — 탭/창 닫기.
 * 스크립트로 연 창만 close()가 되고, 일반 탭에서는 실패하므로 안내가 필요하다.
 */
export type PublicPageLeaveResult = 'closed' | 'backed' | 'stayed';

export function tryLeavePublicPage(): PublicPageLeaveResult {
  if (typeof window === 'undefined') return 'stayed';
  const hadOpener = Boolean(window.opener);
  try {
    window.close();
  } catch {
    /* ignore */
  }
  if (document.visibilityState !== 'visible') return 'closed';

  if (window.history.length > 1) {
    window.history.back();
    return 'backed';
  }

  // opener가 있어도 브라우저가 close를 막은 경우
  if (hadOpener) return 'stayed';
  return 'stayed';
}

export const PUBLIC_PAGE_CLOSE_HINT =
  '이 탭은 브라우저에서 직접 닫아 주세요. (링크를 저장해 두면 제출 내용을 다시 볼 수 있습니다.)';

/**
 * 제출 확인서는 끝 화면이다. 뒤로 가면 같은 확인서가 다시 떠서 버튼이 안 먹은 것처럼 보인다.
 * 창을 닫고, 그대로면 안내를 보여 준다.
 */
export function dismissSubmittedReceipt(onStillOpen: () => void): void {
  if (typeof window === 'undefined') {
    onStillOpen();
    return;
  }
  const href = window.location.href;
  try {
    window.close();
  } catch {
    /* 스크립트로 연 창만 닫힌다 */
  }
  if (document.visibilityState !== 'visible') return;

  const referrer = document.referrer;
  const sameForm =
    !referrer || referrer.includes('/order/') || referrer.includes(window.location.pathname);
  if (!sameForm && window.history.length > 1) {
    window.history.back();
  }

  window.setTimeout(() => {
    if (document.visibilityState === 'visible' && window.location.href === href) onStillOpen();
  }, 400);
}
