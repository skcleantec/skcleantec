/**
 * 토큰 만료/거부를 한곳에서 처리하는 게이트.
 *
 * 배경 (운영 사고 예방):
 * - 만료된 JWT를 가진 클라이언트가 끊지 않고 폴링·WS 재연결을 계속 시도하면,
 *   서버 로그가 폭주하고 사용자도 빈 화면에서 못 빠져나오는 사고가 있다.
 * - 401·WS close(4001/4002/1008) 같은 명시적 거부 신호가 오면
 *   해당 영역의 토큰을 즉시 비우고 로그인 화면으로 보낸다.
 *
 * 사용 패턴:
 *  1) WebSocket close handler: `notifyAuthRejected('ws_close', code)`
 *  2) fetch 응답 401: `notifyAuthRejected('http_401')` — 호출자가 응답 본문의
 *     `code: 'token_expired'` 같은 힌트를 확인한 뒤 호출하면 더 정확하다.
 *  3) ProtectedRoute 등 라우트 가드의 백그라운드 me 검증.
 *
 * URL·라우트 유지 룰을 지키기 위해 현재 `pathname + search + hash`를 sessionStorage에
 * 임시 보관해 두고, 로그인 페이지가 `from`을 우선으로 복귀할 수 있도록 한다.
 */
import { clearToken } from '../stores/auth';
import { clearTeamToken } from '../stores/teamAuth';
import { clearCrewToken } from '../stores/crewAuth';

const RESUME_KEY = 'sk_resume_after_login';

export type AuthRejectionReason = 'http_401' | 'ws_close' | 'me_check';

function detectScopeFromPath(pathname: string): 'admin' | 'team' | 'crew' | 'unknown' {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/team')) return 'team';
  if (pathname.startsWith('/crew')) return 'crew';
  return 'unknown';
}

function rememberResume() {
  try {
    if (typeof window === 'undefined') return;
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith('/login')) return;
    sessionStorage.setItem(
      RESUME_KEY,
      JSON.stringify({ pathname, search, hash })
    );
  } catch {
    /* ignore (private mode 등) */
  }
}

export function readResumeLocation():
  | { pathname: string; search: string; hash: string }
  | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { pathname?: unknown; search?: unknown; hash?: unknown };
    if (typeof v?.pathname !== 'string') return null;
    return {
      pathname: v.pathname,
      search: typeof v.search === 'string' ? v.search : '',
      hash: typeof v.hash === 'string' ? v.hash : '',
    };
  } catch {
    return null;
  }
}

export function clearResumeLocation() {
  try {
    sessionStorage.removeItem(RESUME_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 토큰 거부 알림.
 * - scope를 지정하면 해당 영역 토큰만 비운다 (다른 탭/영역 영향 최소화).
 * - scope 미지정이면 현재 URL로 추론한다.
 */
export function notifyAuthRejected(
  _reason: AuthRejectionReason,
  _detail?: number | string,
  scope?: 'admin' | 'team' | 'crew'
): void {
  const actualScope =
    scope ??
    (typeof window !== 'undefined'
      ? detectScopeFromPath(window.location.pathname)
      : 'unknown');

  rememberResume();

  switch (actualScope) {
    case 'admin':
      clearToken();
      break;
    case 'team':
      clearTeamToken();
      break;
    case 'crew':
      clearCrewToken();
      break;
    default:
      // 알 수 없으면 보수적으로 모두 비운다 (재로그인하면 됨)
      clearToken();
      clearTeamToken();
      clearCrewToken();
      break;
  }

  /**
   * 라우트 가드가 토큰 변경을 감지해 자동으로 `/login`으로 보낸다.
   * 다만 빈 화면처럼 가드 밖이라면 직접 이동시킨다.
   */
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    /**
     * 라우터의 Navigate가 이 변화에 반응할 수 있도록 storage 이벤트가 먼저 흐르게 마이크로태스크 대기.
     */
    setTimeout(() => {
      if (window.location.pathname.startsWith('/login')) return;
      window.location.replace('/login');
    }, 60);
  }
}

/**
 * fetch 응답을 받고 401이면 토큰을 비운다.
 * - response 본문은 소비하지 않는다(호출자가 다시 읽을 수 있게 clone 책임은 호출자).
 */
export function handleHttp401(response: { status: number }): boolean {
  if (response.status === 401) {
    notifyAuthRejected('http_401', response.status);
    return true;
  }
  return false;
}
