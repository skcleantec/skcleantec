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
