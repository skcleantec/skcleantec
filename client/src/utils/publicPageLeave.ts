/**
 * 고객 공개 페이지(발주서·안내 등) — 탭/창 닫기.
 * 카카오톡 인앱은 window.close()를 막으므로 전용 주소로 닫는다.
 * 그 밖은 닫히지 않으면 가운데 안내 카드를 보여 준다.
 */
export type PublicPageLeaveResult = 'closed' | 'backed' | 'stayed';

const HINT_ID = 'public-page-leave-hint';

export function isKakaoTalkInApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes('KAKAOTALK');
}

function userAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent;
}

/** 닫히지 않을 때 그 환경에 맞는 한 줄. */
export function publicPageCloseHint(): string {
  const ua = userAgent();
  if (/NAVER/i.test(ua)) return '오른쪽 위 X로 닫아 주세요.';
  if (/Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua) || /\bLine\//i.test(ua)) {
    return '오른쪽 위 X(또는 뒤로가기)로 닫아 주세요.';
  }
  return '오른쪽 위 X(또는 뒤로가기)로 닫아 주세요.';
}

export const PUBLIC_PAGE_CLOSE_HINT = '오른쪽 위 X(또는 뒤로가기)로 닫아 주세요.';

function showPublicPageCloseCard(message: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(HINT_ID)) return;
  const backdrop = document.createElement('div');
  backdrop.id = HINT_ID;
  backdrop.setAttribute('role', 'status');
  Object.assign(backdrop.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '4000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(15, 23, 42, 0.45)',
  });
  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '100%',
    maxWidth: '320px',
    borderRadius: '16px',
    background: '#ffffff',
    padding: '20px',
    boxShadow: '0 12px 40px rgba(15, 23, 42, 0.18)',
    textAlign: 'center',
    color: '#0f172a',
  });
  const text = document.createElement('p');
  text.textContent = message;
  Object.assign(text.style, {
    margin: '0',
    fontSize: '15px',
    lineHeight: '1.5',
  });
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '알겠어요';
  Object.assign(button.style, {
    marginTop: '16px',
    width: '100%',
    minHeight: '44px',
    border: '0',
    borderRadius: '12px',
    background: '#0f172a',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
  });
  button.addEventListener('click', () => backdrop.remove());
  card.append(text, button);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  backdrop.append(card);
  document.body.append(backdrop);
}

function closeKakaoInApp(): void {
  window.location.href = 'kakaotalk://inappbrowser/close';
}

export function tryLeavePublicPage(): PublicPageLeaveResult {
  if (typeof window === 'undefined') return 'stayed';
  if (isKakaoTalkInApp()) {
    closeKakaoInApp();
    return 'closed';
  }
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

  showPublicPageCloseCard(publicPageCloseHint());
  if (hadOpener) return 'stayed';
  return 'stayed';
}

/**
 * 제출 확인서는 끝 화면이다. 뒤로 가면 같은 확인서가 다시 떠서 버튼이 안 먹은 것처럼 보인다.
 * 창을 닫고, 그대로면 안내를 보여 준다.
 */
export function dismissSubmittedReceipt(onStillOpen: () => void): void {
  if (typeof window === 'undefined') {
    onStillOpen();
    return;
  }
  if (isKakaoTalkInApp()) {
    closeKakaoInApp();
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
    if (document.visibilityState === 'visible' && window.location.href === href) {
      showPublicPageCloseCard(publicPageCloseHint());
      onStillOpen();
    }
  }, 400);
}
